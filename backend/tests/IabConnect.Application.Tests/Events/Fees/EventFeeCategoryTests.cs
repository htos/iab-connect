using FluentAssertions;
using IabConnect.Domain.Events;
using Xunit;

namespace IabConnect.Application.Tests.Events.Fees;

/// <summary>
/// REQ-022 (E4-S1): Unit tests for the <see cref="EventFeeCategory"/> domain entity — invariant
/// guards, soft-retire semantics, applicability + availability logic.
/// </summary>
public class EventFeeCategoryTests
{
    private readonly Guid _eventId = Guid.NewGuid();
    private readonly Guid _createdBy = Guid.NewGuid();

    private EventFeeCategory CreateValid(
        string name = "Adult",
        decimal amount = 25.00m,
        string currency = "CHF",
        FeeApplicability applicability = FeeApplicability.Everyone,
        DateTime? from = null,
        DateTime? until = null,
        int? maxQuantity = null)
        => EventFeeCategory.Create(_eventId, name, amount, currency, applicability, _createdBy,
            description: null, availableFrom: from, availableUntil: until, maxQuantity: maxQuantity);

    [Fact]
    public void Create_WithValidData_ReturnsCategory()
    {
        var cat = CreateValid();

        cat.Id.Should().NotBeEmpty();
        cat.EventId.Should().Be(_eventId);
        cat.Name.Should().Be("Adult");
        cat.Amount.Should().Be(25.00m);
        cat.Currency.Should().Be("CHF");
        cat.Applicability.Should().Be(FeeApplicability.Everyone);
        cat.IsActive.Should().BeTrue();
        cat.CreatedBy.Should().Be(_createdBy);
    }

    [Fact]
    public void Create_NormalizesCurrencyToUpper()
    {
        var cat = CreateValid(currency: "eur");
        cat.Currency.Should().Be("EUR");
    }

    [Fact]
    public void Create_TrimsName()
    {
        var cat = CreateValid(name: "  Member  ");
        cat.Name.Should().Be("Member");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithBlankName_Throws(string name)
    {
        var act = () => CreateValid(name: name);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_WithNegativeAmount_Throws()
    {
        var act = () => CreateValid(amount: -1m);
        act.Should().Throw<ArgumentException>().WithMessage("*negative*");
    }

    [Fact]
    public void Create_WithMoreThanTwoDecimals_Throws()
    {
        var act = () => CreateValid(amount: 25.123m);
        act.Should().Throw<ArgumentException>().WithMessage("*2 decimal*");
    }

    [Fact]
    public void Create_WithZeroAmount_IsAllowed()
    {
        var cat = CreateValid(amount: 0m);
        cat.Amount.Should().Be(0m);
    }

    [Theory]
    [InlineData("CH")]
    [InlineData("CHFF")]
    [InlineData("C1F")]
    public void Create_WithInvalidCurrencyShape_Throws(string currency)
    {
        var act = () => CreateValid(currency: currency);
        act.Should().Throw<ArgumentException>().WithMessage("*ISO*");
    }

    [Fact]
    public void Create_WithUntilBeforeFrom_Throws()
    {
        var from = DateTime.UtcNow.AddDays(5);
        var until = DateTime.UtcNow.AddDays(2);
        var act = () => CreateValid(from: from, until: until);
        act.Should().Throw<ArgumentException>().WithMessage("*after*");
    }

    [Fact]
    public void Create_WithZeroMaxQuantity_Throws()
    {
        var act = () => CreateValid(maxQuantity: 0);
        act.Should().Throw<ArgumentException>().WithMessage("*MaxQuantity*");
    }

    [Fact]
    public void Deactivate_FlipsIsActive_AndIsIdempotent()
    {
        var cat = CreateValid();
        cat.Deactivate();
        cat.IsActive.Should().BeFalse();
        // idempotent — second call does not throw
        cat.Deactivate();
        cat.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Reactivate_RestoresIsActive()
    {
        var cat = CreateValid();
        cat.Deactivate();
        cat.Reactivate();
        cat.IsActive.Should().BeTrue();
    }

    [Fact]
    public void IsAvailableAt_RespectsWindowAndActiveFlag()
    {
        var now = DateTime.UtcNow;
        var cat = CreateValid(from: now.AddDays(-1), until: now.AddDays(1));

        cat.IsAvailableAt(now).Should().BeTrue();
        cat.IsAvailableAt(now.AddDays(-2)).Should().BeFalse("before the window");
        cat.IsAvailableAt(now.AddDays(2)).Should().BeFalse("after the window");

        cat.Deactivate();
        cat.IsAvailableAt(now).Should().BeFalse("inactive categories are never available");
    }

    [Fact]
    public void IsAvailableAt_OpenEndedWindow_AlwaysAvailableWhenActive()
    {
        var cat = CreateValid(); // no window
        cat.IsAvailableAt(DateTime.UtcNow).Should().BeTrue();
        cat.IsAvailableAt(DateTime.UtcNow.AddYears(5)).Should().BeTrue();
    }

    [Theory]
    [InlineData(FeeApplicability.Everyone, true, true)]
    [InlineData(FeeApplicability.Everyone, false, true)]
    [InlineData(FeeApplicability.MembersOnly, true, true)]
    [InlineData(FeeApplicability.MembersOnly, false, false)]
    [InlineData(FeeApplicability.PublicOnly, true, false)]
    [InlineData(FeeApplicability.PublicOnly, false, true)]
    public void AppliesTo_RespectsApplicability(FeeApplicability applicability, bool isMember, bool expected)
    {
        var cat = CreateValid(applicability: applicability);
        cat.AppliesTo(isMember).Should().Be(expected);
    }

    [Fact]
    public void UpdateDetails_ChangesFields_AndStampsUpdatedAt()
    {
        var cat = CreateValid();
        cat.UpdateDetails("VIP", 99.50m, "EUR", FeeApplicability.MembersOnly,
            "Premium seating", availableFrom: null, availableUntil: null, maxQuantity: 10);

        cat.Name.Should().Be("VIP");
        cat.Amount.Should().Be(99.50m);
        cat.Currency.Should().Be("EUR");
        cat.Applicability.Should().Be(FeeApplicability.MembersOnly);
        cat.Description.Should().Be("Premium seating");
        cat.MaxQuantity.Should().Be(10);
        cat.UpdatedAt.Should().NotBeNull();
    }
}
