using FluentAssertions;
using FluentValidation.TestHelper;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Budgets.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance.Budgets;

/// <summary>
/// REQ-044 (E6-S1): Unit tests for the Budget entity, validators, and the create handler
/// (existence / locked-period / uniqueness guards + audit).
/// </summary>
public class BudgetTests
{
    private static readonly Guid AreaId = Guid.NewGuid();
    private static readonly Guid PeriodId = Guid.NewGuid();

    #region Entity

    [Fact]
    public void Create_Should_Create_With_Valid_Data()
    {
        var budget = Budget.Create(AreaId, PeriodId, 1500.50m, FinanceCurrency.CHF, "  Diwali  ", "kassier");

        budget.ActivityAreaId.Should().Be(AreaId);
        budget.FiscalPeriodId.Should().Be(PeriodId);
        budget.Amount.Should().Be(1500.50m);
        budget.Currency.Should().Be(FinanceCurrency.CHF);
        budget.Notes.Should().Be("Diwali");
        budget.CreatedBy.Should().Be("kassier");
        budget.IsDeleted.Should().BeFalse();
        budget.Id.Should().NotBe(Guid.Empty);
        budget.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void Create_Should_Allow_Zero_Amount()
    {
        var act = () => Budget.Create(AreaId, PeriodId, 0m, FinanceCurrency.EUR, null, "kassier");
        act.Should().NotThrow();
    }

    [Fact]
    public void Create_Should_Throw_When_Amount_Negative()
    {
        var act = () => Budget.Create(AreaId, PeriodId, -1m, FinanceCurrency.CHF, null, "kassier");
        act.Should().Throw<ArgumentOutOfRangeException>().WithParameterName("amount");
    }

    [Fact]
    public void Create_Should_Throw_When_AreaId_Empty()
    {
        var act = () => Budget.Create(Guid.Empty, PeriodId, 1m, FinanceCurrency.CHF, null, "kassier");
        act.Should().Throw<ArgumentException>().WithParameterName("activityAreaId");
    }

    [Fact]
    public void Update_Should_Throw_When_Amount_Negative()
    {
        var budget = Budget.Create(AreaId, PeriodId, 100m, FinanceCurrency.CHF, null, "kassier");
        var act = () => budget.Update(-5m, FinanceCurrency.CHF, null, "kassier");
        act.Should().Throw<ArgumentOutOfRangeException>().WithParameterName("amount");
    }

    [Fact]
    public void Update_Should_Mutate_Fields()
    {
        var budget = Budget.Create(AreaId, PeriodId, 100m, FinanceCurrency.CHF, "old", "kassier");
        budget.Update(250m, FinanceCurrency.EUR, "new", "admin");

        budget.Amount.Should().Be(250m);
        budget.Currency.Should().Be(FinanceCurrency.EUR);
        budget.Notes.Should().Be("new");
        budget.UpdatedBy.Should().Be("admin");
        budget.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void SoftDelete_Should_Set_Flags()
    {
        var budget = Budget.Create(AreaId, PeriodId, 100m, FinanceCurrency.CHF, null, "kassier");
        budget.SoftDelete("admin");

        budget.IsDeleted.Should().BeTrue();
        budget.DeletedBy.Should().Be("admin");
        budget.DeletedAt.Should().NotBeNull();
    }

    #endregion

    #region Validators

    [Fact]
    public void CreateValidator_Should_Reject_Negative_Amount()
    {
        var validator = new CreateBudgetCommandValidator();
        var result = validator.TestValidate(new CreateBudgetCommand
        {
            ActivityAreaId = AreaId, FiscalPeriodId = PeriodId, Amount = -1m, UserName = "kassier"
        });
        result.ShouldHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void CreateValidator_Should_Reject_Invalid_Currency()
    {
        var validator = new CreateBudgetCommandValidator();
        var result = validator.TestValidate(new CreateBudgetCommand
        {
            ActivityAreaId = AreaId, FiscalPeriodId = PeriodId, Amount = 10m,
            Currency = "USD", UserName = "kassier"
        });
        result.ShouldHaveValidationErrorFor(x => x.Currency);
    }

    [Fact]
    public void CreateValidator_Should_Accept_Null_Currency()
    {
        var validator = new CreateBudgetCommandValidator();
        var result = validator.TestValidate(new CreateBudgetCommand
        {
            ActivityAreaId = AreaId, FiscalPeriodId = PeriodId, Amount = 10m,
            Currency = null, UserName = "kassier"
        });
        result.ShouldNotHaveValidationErrorFor(x => x.Currency);
    }

    [Fact]
    public void CreateValidator_Should_Reject_Empty_AreaAndPeriod_And_User()
    {
        var validator = new CreateBudgetCommandValidator();
        var result = validator.TestValidate(new CreateBudgetCommand
        {
            ActivityAreaId = Guid.Empty, FiscalPeriodId = Guid.Empty, Amount = 10m, UserName = ""
        });
        result.ShouldHaveValidationErrorFor(x => x.ActivityAreaId);
        result.ShouldHaveValidationErrorFor(x => x.FiscalPeriodId);
        result.ShouldHaveValidationErrorFor(x => x.UserName);
    }

    #endregion

    #region Create handler

    private static FiscalPeriod OpenPeriod()
        => FiscalPeriod.Create(2026, 1, new DateTime(2026, 1, 1), new DateTime(2026, 1, 31));

    private (CreateBudgetCommandHandler handler,
        Mock<IBudgetRepository> budgetRepo,
        Mock<IActivityAreaRepository> areaRepo,
        Mock<IFiscalPeriodRepository> periodRepo,
        Mock<IFinanceProfileRepository> profileRepo,
        Mock<IUnitOfWork> uow,
        Mock<IAuditService> audit) BuildHandler(ActivityArea area, FiscalPeriod period)
    {
        var budgetRepo = new Mock<IBudgetRepository>();
        var areaRepo = new Mock<IActivityAreaRepository>();
        var periodRepo = new Mock<IFiscalPeriodRepository>();
        var profileRepo = new Mock<IFinanceProfileRepository>();
        var uow = new Mock<IUnitOfWork>();
        var audit = new Mock<IAuditService>();

        areaRepo.Setup(r => r.GetByIdAsync(area.Id, It.IsAny<CancellationToken>())).ReturnsAsync(area);
        periodRepo.Setup(r => r.GetByIdAsync(period.Id, It.IsAny<CancellationToken>())).ReturnsAsync(period);
        budgetRepo.Setup(r => r.GetByActivityAreaAndPeriodAsync(area.Id, period.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Budget?)null);

        var handler = new CreateBudgetCommandHandler(
            budgetRepo.Object, areaRepo.Object, periodRepo.Object,
            profileRepo.Object, uow.Object, audit.Object);

        return (handler, budgetRepo, areaRepo, periodRepo, profileRepo, uow, audit);
    }

    private static CreateBudgetCommand Cmd(Guid areaId, Guid periodId, string? currency = null) => new()
    {
        ActivityAreaId = areaId, FiscalPeriodId = periodId, Amount = 500m,
        Currency = currency, Notes = "Q1", UserName = "kassier"
    };

    [Fact]
    public async Task Create_Should_Persist_And_Audit()
    {
        var area = ActivityArea.Create("Events", "EVT", null, null, 1);
        var period = OpenPeriod();
        var (handler, budgetRepo, _, _, _, uow, audit) = BuildHandler(area, period);

        var dto = await handler.Handle(Cmd(area.Id, period.Id, "CHF"), CancellationToken.None);

        dto.Amount.Should().Be(500m);
        dto.Currency.Should().Be("CHF");
        dto.ActivityAreaName.Should().Be("Events");
        budgetRepo.Verify(r => r.AddAsync(It.IsAny<Budget>(), It.IsAny<CancellationToken>()), Times.Once);
        uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        audit.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceCreated, It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string?>(),
            "Budget", It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_Should_Default_Currency_From_Active_Profile()
    {
        var area = ActivityArea.Create("Events", "EVT", null, null, 1);
        var period = OpenPeriod();
        var (handler, _, _, _, profileRepo, _, _) = BuildHandler(area, period);
        var profile = FinanceProfile.Create(Jurisdiction.EU, "DE", FinanceCurrency.EUR, 1,
            "Verein", "Str 1", "Berlin", "10115", "DE",
            null, null, null, null, null, null, null);
        profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>())).ReturnsAsync(profile);

        var dto = await handler.Handle(Cmd(area.Id, period.Id, currency: null), CancellationToken.None);

        dto.Currency.Should().Be("EUR");
    }

    [Fact]
    public async Task Create_Should_Throw_When_Area_Missing()
    {
        var area = ActivityArea.Create("Events", "EVT", null, null, 1);
        var period = OpenPeriod();
        var (handler, _, areaRepo, _, _, _, _) = BuildHandler(area, period);
        areaRepo.Setup(r => r.GetByIdAsync(area.Id, It.IsAny<CancellationToken>())).ReturnsAsync((ActivityArea?)null);

        var act = () => handler.Handle(Cmd(area.Id, period.Id), CancellationToken.None);
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Create_Should_Throw_When_Area_Inactive()
    {
        var area = ActivityArea.Create("Events", "EVT", null, null, 1);
        area.Update("Events", "EVT", null, null, 1, isActive: false);
        var period = OpenPeriod();
        var (handler, _, _, _, _, _, _) = BuildHandler(area, period);

        var act = () => handler.Handle(Cmd(area.Id, period.Id), CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task Create_Should_Throw_When_Period_Locked()
    {
        var area = ActivityArea.Create("Events", "EVT", null, null, 1);
        var period = OpenPeriod();
        period.Lock("admin");
        var (handler, _, _, _, _, _, _) = BuildHandler(area, period);

        var act = () => handler.Handle(Cmd(area.Id, period.Id), CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*locked*");
    }

    [Fact]
    public async Task Create_Should_Throw_When_Duplicate_Exists()
    {
        var area = ActivityArea.Create("Events", "EVT", null, null, 1);
        var period = OpenPeriod();
        var (handler, budgetRepo, _, _, _, _, _) = BuildHandler(area, period);
        budgetRepo.Setup(r => r.GetByActivityAreaAndPeriodAsync(area.Id, period.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Budget.Create(area.Id, period.Id, 1m, FinanceCurrency.CHF, null, "x"));

        var act = () => handler.Handle(Cmd(area.Id, period.Id), CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*already exists*");
    }

    #endregion
}
