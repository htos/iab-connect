using FluentAssertions;
using IabConnect.Application.Events.Fees.Commands;
using IabConnect.Domain.Events;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.Fees;

/// <summary>
/// REQ-022 (E4-S1): Validator + handler tests for <see cref="CreateEventFeeCategoryCommand"/>.
/// </summary>
public class CreateEventFeeCategoryCommandTests
{
    private readonly Guid _eventId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly CreateEventFeeCategoryCommandValidator _validator = new();

    private CreateEventFeeCategoryCommand ValidCommand(
        string name = "Adult", decimal amount = 25m, string currency = "CHF", string applicability = "Everyone")
        => new(_eventId, name, null, amount, currency, applicability, null, null, null, _userId);

    [Fact]
    public void Validator_AcceptsValidCommand()
    {
        _validator.Validate(ValidCommand()).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("USD")]
    [InlineData("xyz")]
    [InlineData("")]
    public void Validator_RejectsUnsupportedCurrency(string currency)
    {
        _validator.Validate(ValidCommand(currency: currency)).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("Members")]
    [InlineData("everyone")] // case-sensitive: must be PascalCase
    [InlineData("")]
    public void Validator_RejectsInvalidApplicability(string applicability)
    {
        _validator.Validate(ValidCommand(applicability: applicability)).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validator_RejectsNegativeAmount()
    {
        _validator.Validate(ValidCommand(amount: -5m)).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validator_RejectsBlankName()
    {
        _validator.Validate(ValidCommand(name: "   ")).IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task Handler_CreatesCategory_WhenEventExistsAndNameFree()
    {
        var events = new Mock<IEventRepository>();
        events.Setup(e => e.GetByIdAsync(_eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Event.Create("E", "D", "L", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(2)));
        var categories = new Mock<IEventFeeCategoryRepository>();
        categories.Setup(c => c.ActiveNameExistsAsync(_eventId, "Adult", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var handler = new CreateEventFeeCategoryCommandHandler(categories.Object, events.Object);
        var dto = await handler.Handle(ValidCommand(), TestContext.Current.CancellationToken);

        dto.Name.Should().Be("Adult");
        dto.Amount.Should().Be(25m);
        dto.IsActive.Should().BeTrue();
        categories.Verify(c => c.AddAsync(It.IsAny<EventFeeCategory>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handler_Throws_WhenEventMissing()
    {
        var events = new Mock<IEventRepository>();
        events.Setup(e => e.GetByIdAsync(_eventId, It.IsAny<CancellationToken>())).ReturnsAsync((Event?)null);
        var categories = new Mock<IEventFeeCategoryRepository>();

        var handler = new CreateEventFeeCategoryCommandHandler(categories.Object, events.Object);
        var act = () => handler.Handle(ValidCommand(), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<KeyNotFoundException>();
        categories.Verify(c => c.AddAsync(It.IsAny<EventFeeCategory>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handler_Throws_WhenActiveNameDuplicate()
    {
        var events = new Mock<IEventRepository>();
        events.Setup(e => e.GetByIdAsync(_eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Event.Create("E", "D", "L", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(2)));
        var categories = new Mock<IEventFeeCategoryRepository>();
        categories.Setup(c => c.ActiveNameExistsAsync(_eventId, "Adult", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var handler = new CreateEventFeeCategoryCommandHandler(categories.Object, events.Object);
        var act = () => handler.Handle(ValidCommand(), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*already exists*");
        categories.Verify(c => c.AddAsync(It.IsAny<EventFeeCategory>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
