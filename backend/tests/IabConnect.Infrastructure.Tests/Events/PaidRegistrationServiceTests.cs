using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Domain.Events;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Events;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Events;

/// <summary>
/// REQ-022 (E4-S2): Testcontainers-backed proofs for the paid-registration coordinator and the
/// cancellation invoice disposition — the load-bearing atomicity + finance-compliance behaviour.
/// Uses real PostgreSQL (EF InMemory cannot prove transactional rollback or the raw-SQL invoice
/// numbering).
/// </summary>
public sealed class PaidRegistrationServiceTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private DbContextOptions<ApplicationDbContext> _options = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        _options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        await using var seed = new ApplicationDbContext(_options);
        await seed.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync() => await _postgres.DisposeAsync();

    // ---- helpers ----------------------------------------------------------------

    private async Task<Event> SeedEventAsync(bool waitlistEnabled = false)
    {
        await using var ctx = new ApplicationDbContext(_options);
        var evt = Event.Create("Workshop", "A paid workshop", "Hall",
            DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(10).AddHours(3));
        ctx.Events.Add(evt);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        return evt;
    }

    private PaidRegistrationService CreateService(
        ApplicationDbContext ctx,
        Mock<IFiscalPeriodService>? fiscal = null,
        FinanceProfile? activeProfile = null)
    {
        fiscal ??= new Mock<IFiscalPeriodService>();
        var profileRepo = new Mock<IFinanceProfileRepository>();
        profileRepo
            .Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(activeProfile);
        return new PaidRegistrationService(
            ctx, new InvoiceRepository(ctx), fiscal.Object, profileRepo.Object, Mock.Of<IAuditService>());
    }

    /// <summary>The real invoice-number counter has an FK to finance_profiles, so paid
    /// registration requires an active profile to exist (it always will in production).</summary>
    private async Task SeedFinanceProfileAsync(FinanceCurrency currency = FinanceCurrency.CHF)
    {
        await using var ctx = new ApplicationDbContext(_options);
        ctx.FinanceProfiles.Add(Profile(currency));
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static EventFeeCategory FeeCategory(Guid eventId, decimal amount = 25m, string currency = "CHF") =>
        EventFeeCategory.Create(eventId, "Adult", amount, currency, FeeApplicability.Everyone, Guid.NewGuid());

    private static FinanceProfile Profile(FinanceCurrency currency) =>
        FinanceProfile.Create(
            Jurisdiction.CH, "CH", currency, 1,
            "Verein", "Street 1", "Zürich", "8000", "CH",
            null, null, null, null, null, null, null);

    // ---- coordinator: happy path -----------------------------------------------

    [Fact]
    public async Task CreatePaidRegistration_Guest_PersistsRegistrationAndLinkedInvoice()
    {
        var evt = await SeedEventAsync();
        await SeedFinanceProfileAsync();
        await using var ctx = new ApplicationDbContext(_options);
        var svc = CreateService(ctx);

        var registration = EventRegistration.CreateForGuest(evt.Id, "Jane Guest", "jane@example.com", numberOfGuests: 2);
        var fee = FeeCategory(evt.Id, amount: 25m);

        var result = await svc.CreatePaidRegistrationAsync(
            registration, fee, evt.Title, evt.StartDate, TestContext.Current.CancellationToken);

        result.InvoiceNumber.Should().NotBeNullOrWhiteSpace();

        await using var verify = new ApplicationDbContext(_options);
        var reg = await verify.EventRegistrations.AsNoTracking()
            .SingleAsync(r => r.Id == registration.Id, TestContext.Current.CancellationToken);
        var invoice = await verify.Invoices.AsNoTracking().Include(i => i.Items)
            .SingleAsync(i => i.EventRegistrationId == registration.Id, TestContext.Current.CancellationToken);

        reg.ParticipantName.Should().Be("Jane Guest");
        invoice.RecipientType.Should().Be(RecipientType.Other);
        invoice.RecipientId.Should().BeNull();
        invoice.RecipientName.Should().Be("Jane Guest");
        invoice.Status.Should().Be(InvoiceStatus.Draft);
        invoice.Total.Should().Be(50m); // 2 × 25
        invoice.Items.Should().ContainSingle().Which.Description.Should().Contain("Adult");
    }

    [Fact]
    public async Task CreatePaidRegistration_Member_UsesMemberRecipient()
    {
        var evt = await SeedEventAsync();
        await SeedFinanceProfileAsync();
        await using var ctx = new ApplicationDbContext(_options);
        var svc = CreateService(ctx);

        var memberId = Guid.NewGuid();
        var registration = EventRegistration.CreateForMember(
            evt.Id, Guid.NewGuid(), memberId, "Max Member", "max@example.com");
        var fee = FeeCategory(evt.Id, amount: 40m);

        await svc.CreatePaidRegistrationAsync(registration, fee, evt.Title, evt.StartDate, TestContext.Current.CancellationToken);

        await using var verify = new ApplicationDbContext(_options);
        var invoice = await verify.Invoices.AsNoTracking()
            .SingleAsync(i => i.EventRegistrationId == registration.Id, TestContext.Current.CancellationToken);
        invoice.RecipientType.Should().Be(RecipientType.Member);
        invoice.RecipientId.Should().Be(memberId);
        invoice.Total.Should().Be(40m);
    }

    // ---- coordinator: failure → nothing persisted (AC-3) -----------------------

    [Fact]
    public async Task CreatePaidRegistration_FiscalPeriodLocked_PersistsNothing()
    {
        var evt = await SeedEventAsync();
        await using var ctx = new ApplicationDbContext(_options);
        var fiscal = new Mock<IFiscalPeriodService>();
        fiscal.Setup(f => f.EnsurePeriodNotLockedAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Fiscal period is locked."));
        var svc = CreateService(ctx, fiscal);

        var registration = EventRegistration.CreateForGuest(evt.Id, "Jane Guest", "jane@example.com");
        var fee = FeeCategory(evt.Id);

        var act = async () => await svc.CreatePaidRegistrationAsync(
            registration, fee, evt.Title, evt.StartDate, TestContext.Current.CancellationToken);
        await act.Should().ThrowAsync<InvalidOperationException>();

        await using var verify = new ApplicationDbContext(_options);
        (await verify.EventRegistrations.AsNoTracking()
            .AnyAsync(r => r.Id == registration.Id, TestContext.Current.CancellationToken)).Should().BeFalse();
        (await verify.Invoices.AsNoTracking()
            .AnyAsync(i => i.EventRegistrationId == registration.Id, TestContext.Current.CancellationToken)).Should().BeFalse();
    }

    [Fact]
    public async Task CreatePaidRegistration_CurrencyMismatch_PersistsNothing()
    {
        var evt = await SeedEventAsync();
        await using var ctx = new ApplicationDbContext(_options);
        // Active profile is EUR; the fee category is CHF → reject.
        var svc = CreateService(ctx, activeProfile: Profile(FinanceCurrency.EUR));

        var registration = EventRegistration.CreateForGuest(evt.Id, "Jane Guest", "jane@example.com");
        var fee = FeeCategory(evt.Id, currency: "CHF");

        var act = async () => await svc.CreatePaidRegistrationAsync(
            registration, fee, evt.Title, evt.StartDate, TestContext.Current.CancellationToken);
        await act.Should().ThrowAsync<InvalidOperationException>();

        await using var verify = new ApplicationDbContext(_options);
        (await verify.EventRegistrations.AsNoTracking()
            .AnyAsync(r => r.Id == registration.Id, TestContext.Current.CancellationToken)).Should().BeFalse();
        (await verify.Invoices.AsNoTracking()
            .AnyAsync(i => i.EventRegistrationId == registration.Id, TestContext.Current.CancellationToken)).Should().BeFalse();
    }

    // ---- cancellation disposition (AC-4) ---------------------------------------

    private async Task<(Guid registrationId, Guid invoiceId)> SeedRegistrationWithInvoiceAsync(
        Guid eventId, InvoiceStatus status)
    {
        await using var ctx = new ApplicationDbContext(_options);
        var registration = EventRegistration.CreateForGuest(eventId, "Paid Guest", "paid@example.com");
        ctx.EventRegistrations.Add(registration);

        var invoice = Invoice.Create(
            $"INV-TEST-{Guid.NewGuid():N}".Substring(0, 16), DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Other, null, "Paid Guest", null, 0m, null, "test",
            eventRegistrationId: registration.Id);
        invoice.AddItem("Adult", 1, 25m);
        if (status is InvoiceStatus.Sent or InvoiceStatus.Paid)
            invoice.MarkAsSent("test");
        if (status is InvoiceStatus.Paid)
            invoice.MarkAsPaid("test");
        ctx.Invoices.Add(invoice);

        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        return (registration.Id, invoice.Id);
    }

    private async Task CancelAsync(Guid eventId, Guid registrationId)
    {
        await using var ctx = new ApplicationDbContext(_options);
        await new EventRegistrationCancellationService(ctx, Mock.Of<IAuditService>())
            .CancelAsync(eventId, registrationId, "changed plans", cancelledByParticipant: true,
                TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Cancel_DraftInvoice_SoftDeletesInvoice()
    {
        var evt = await SeedEventAsync();
        var (regId, invoiceId) = await SeedRegistrationWithInvoiceAsync(evt.Id, InvoiceStatus.Draft);

        await CancelAsync(evt.Id, regId);

        await using var verify = new ApplicationDbContext(_options);
        var invoice = await verify.Invoices.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == invoiceId, TestContext.Current.CancellationToken);
        invoice.IsDeleted.Should().BeTrue();
        invoice.Status.Should().Be(InvoiceStatus.Draft); // soft-delete, not status change
    }

    [Fact]
    public async Task Cancel_SentInvoice_CancelsInvoice()
    {
        var evt = await SeedEventAsync();
        var (regId, invoiceId) = await SeedRegistrationWithInvoiceAsync(evt.Id, InvoiceStatus.Sent);

        await CancelAsync(evt.Id, regId);

        await using var verify = new ApplicationDbContext(_options);
        var invoice = await verify.Invoices.AsNoTracking()
            .SingleAsync(i => i.Id == invoiceId, TestContext.Current.CancellationToken);
        invoice.Status.Should().Be(InvoiceStatus.Cancelled);
        invoice.CancellationReason.Should().NotBeNullOrWhiteSpace();
        invoice.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public async Task Cancel_PaidInvoice_LeftIntact()
    {
        var evt = await SeedEventAsync();
        var (regId, invoiceId) = await SeedRegistrationWithInvoiceAsync(evt.Id, InvoiceStatus.Paid);

        await CancelAsync(evt.Id, regId);

        await using var verify = new ApplicationDbContext(_options);
        var invoice = await verify.Invoices.AsNoTracking()
            .SingleAsync(i => i.Id == invoiceId, TestContext.Current.CancellationToken);
        invoice.Status.Should().Be(InvoiceStatus.Paid); // no auto-refund — left for manual handling
        invoice.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public async Task Cancel_FreeRegistration_NoInvoiceTouched()
    {
        var evt = await SeedEventAsync();
        await using (var ctx = new ApplicationDbContext(_options))
        {
            var registration = EventRegistration.CreateForGuest(evt.Id, "Free Guest", "free@example.com");
            ctx.EventRegistrations.Add(registration);
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

            await new EventRegistrationCancellationService(ctx, Mock.Of<IAuditService>())
                .CancelAsync(evt.Id, registration.Id, null, true, TestContext.Current.CancellationToken);

            await using var verify = new ApplicationDbContext(_options);
            var reg = await verify.EventRegistrations.AsNoTracking()
                .SingleAsync(r => r.Id == registration.Id, TestContext.Current.CancellationToken);
            reg.Status.Should().Be(RegistrationStatus.Cancelled);
            (await verify.Invoices.IgnoreQueryFilters().AsNoTracking()
                .AnyAsync(TestContext.Current.CancellationToken)).Should().BeFalse();
        }
    }
}
