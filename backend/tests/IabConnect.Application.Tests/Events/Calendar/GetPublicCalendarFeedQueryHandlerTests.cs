using FluentAssertions;
using IabConnect.Application.Events.Calendar;
using IabConnect.Domain.Events;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.Calendar;

/// <summary>
/// REQ-025 (E3.S5) AC-1 / AC-10: the public anonymous calendar feed. The privacy guarantee —
/// only Published + Public events ever reach the unauthenticated feed — is enforced by the
/// repository's <see cref="IEventRepository.GetPublicEventsAsync"/>; these tests lock in that
/// the handler (a) routes exclusively through that visibility-filtered method and never a
/// broad <c>GetAll</c>/<c>GetPaged</c> path, (b) bounds the EndDate window so the anonymous
/// endpoint cannot be made to materialise an unbounded row set, and (c) emits every event the
/// repository returns — no silent drops.
///
/// Closes the cleanup-sprint <c>calendar-feed-api-tests</c> item (Epic-3-retro §9): the AC-1
/// public-feed visibility filter previously had zero automated coverage.
/// </summary>
public sealed class GetPublicCalendarFeedQueryHandlerTests
{
    private readonly Mock<IEventRepository> _events = new(MockBehavior.Strict);
    private readonly ICalendarFeedBuilder _builder = new CalendarFeedBuilder();

    private GetPublicCalendarFeedQueryHandler Sut() => new(_events.Object, _builder);

    [Fact]
    public async Task Handle_RoutesExclusivelyThroughTheVisibilityFilteredRepositoryMethod()
    {
        // MockBehavior.Strict: any call other than the one set up below throws. Setting up only
        // GetPublicEventsAsync + asserting VerifyNoOtherCalls proves the handler can never reach
        // a broad GetAllAsync / GetPagedAsync path that would skip the Public+Published filter.
        _events.Setup(e => e.GetPublicEventsAsync(
                It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<Event>() as IReadOnlyList<Event>);

        await Sut().Handle(new GetPublicCalendarFeedQuery("https://example"), CancellationToken.None);

        _events.Verify(e => e.GetPublicEventsAsync(
            It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()), Times.Once);
        _events.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_BoundsEndDateWindow_90dPastTo2yFuture()
    {
        DateTime? capturedFrom = null;
        DateTime? capturedTo = null;
        _events.Setup(e => e.GetPublicEventsAsync(
                It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .Callback<DateTime?, DateTime?, CancellationToken>((f, t, _) =>
            {
                capturedFrom = f;
                capturedTo = t;
            })
            .ReturnsAsync(Array.Empty<Event>() as IReadOnlyList<Event>);

        await Sut().Handle(new GetPublicCalendarFeedQuery("https://example"), CancellationToken.None);

        // R4-P-S5-1: both bounds are pushed into SQL so the anonymous endpoint cannot be made
        // to materialise every public event ever created.
        capturedFrom.Should().NotBeNull();
        capturedFrom!.Value.Should().BeBefore(DateTime.UtcNow.AddDays(-89));
        capturedFrom.Value.Should().BeAfter(DateTime.UtcNow.AddDays(-91));
        capturedTo.Should().NotBeNull();
        capturedTo!.Value.Should().BeAfter(DateTime.UtcNow.AddYears(2).AddDays(-1));
        capturedTo.Value.Should().BeBefore(DateTime.UtcNow.AddYears(2).AddDays(1));
    }

    [Fact]
    public async Task Handle_EmptyRepository_ReturnsValidEmptyIcsEnvelope()
    {
        _events.Setup(e => e.GetPublicEventsAsync(
                It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<Event>() as IReadOnlyList<Event>);

        var result = await Sut().Handle(
            new GetPublicCalendarFeedQuery("https://example"), CancellationToken.None);

        result.Should().NotBeNull();
        result.IcsContent.Should().Contain("BEGIN:VCALENDAR");
        result.IcsContent.Should().Contain("END:VCALENDAR");
        result.IcsContent.Should().NotContain("BEGIN:VEVENT");
    }

    [Fact]
    public async Task Handle_EmitsEveryEventTheRepositoryReturns()
    {
        var first = CreatePublishedPublicEvent("Spring festival");
        var second = CreatePublishedPublicEvent("Autumn gala");
        _events.Setup(e => e.GetPublicEventsAsync(
                It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { first, second } as IReadOnlyList<Event>);

        var result = await Sut().Handle(
            new GetPublicCalendarFeedQuery("https://example"), CancellationToken.None);

        result.IcsContent.Should().Contain("SUMMARY:Spring festival");
        result.IcsContent.Should().Contain("SUMMARY:Autumn gala");
        System.Text.RegularExpressions.Regex
            .Matches(result.IcsContent, "BEGIN:VEVENT")
            .Count.Should().Be(2);
    }

    private static Event CreatePublishedPublicEvent(string title)
    {
        var evt = Event.Create(title, "desc", "Venue",
            DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(2));
        evt.SetVisibility(EventVisibility.Public);
        evt.Publish();
        return evt;
    }
}
