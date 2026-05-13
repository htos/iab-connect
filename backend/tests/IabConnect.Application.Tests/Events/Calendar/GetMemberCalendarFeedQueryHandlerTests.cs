using FluentAssertions;
using IabConnect.Application.Events.Calendar;
using IabConnect.Domain.Events;
using IabConnect.Domain.Members;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.Calendar;

/// <summary>
/// REQ-025 (E3.S5) AC-10: Token-resolution edge cases for the per-member feed.
/// </summary>
public sealed class GetMemberCalendarFeedQueryHandlerTests
{
    private readonly Mock<IMemberRepository> _members = new(MockBehavior.Strict);
    private readonly Mock<IEventRepository> _events = new(MockBehavior.Strict);
    private readonly ICalendarFeedBuilder _builder = new CalendarFeedBuilder();

    private GetMemberCalendarFeedQueryHandler Sut() =>
        new(_members.Object, _events.Object, _builder);

    [Fact]
    public async Task Handle_TokenNotFound_ReturnsNull()
    {
        _members.Setup(m => m.GetByCalendarTokenAsync("unknown", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        var result = await Sut().Handle(
            new GetMemberCalendarFeedQuery("unknown", "https://example"),
            CancellationToken.None);

        result.Should().BeNull();
        _events.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_TokenFound_IncludesPublicAndMembersOnlyEvents_ExcludesHidden()
    {
        var member = Member.Create("Test", "Person", "test@example.com",
            Address.Create("S 1", "City", "1000", "Country"),
            MembershipType.Regular);

        _members.Setup(m => m.GetByCalendarTokenAsync("valid", It.IsAny<CancellationToken>()))
            .ReturnsAsync(member);

        var publicEvt = CreatePublishedEvent("Public party", EventVisibility.Public);
        var membersEvt = CreatePublishedEvent("Members night", EventVisibility.MembersOnly);
        var hiddenEvt = CreatePublishedEvent("Hidden agenda", EventVisibility.Hidden);

        _events.Setup(e => e.GetPagedAsync(
            It.IsAny<EventFilterOptions>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((new[] { publicEvt, membersEvt, hiddenEvt } as IReadOnlyList<Event>, 3));

        var result = await Sut().Handle(
            new GetMemberCalendarFeedQuery("valid", "https://example"),
            CancellationToken.None);

        result.Should().NotBeNull();
        result!.IcsContent.Should().Contain("SUMMARY:Public party");
        result.IcsContent.Should().Contain("SUMMARY:Members night");
        result.IcsContent.Should().NotContain("SUMMARY:Hidden agenda");
    }

    [Fact]
    public async Task Handle_FilterUsesPublishedAndLast90dWindow()
    {
        var member = Member.Create("Test", "Person", "test@example.com",
            Address.Create("S 1", "City", "1000", "Country"),
            MembershipType.Regular);

        EventFilterOptions? capturedFilter = null;
        _members.Setup(m => m.GetByCalendarTokenAsync("valid", It.IsAny<CancellationToken>()))
            .ReturnsAsync(member);
        _events.Setup(e => e.GetPagedAsync(
            It.IsAny<EventFilterOptions>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Callback<EventFilterOptions, int, int, CancellationToken>((f, _, _, _) => capturedFilter = f)
            .ReturnsAsync((Array.Empty<Event>() as IReadOnlyList<Event>, 0));

        await Sut().Handle(new GetMemberCalendarFeedQuery("valid", "https://example"), CancellationToken.None);

        capturedFilter.Should().NotBeNull();
        capturedFilter!.Status.Should().Be(EventStatus.Published);
        // Post-review M-S5-5: window now uses EndDate (so multi-day events that started
        // before the window but are still running stay in the feed). M-S5-2: window also
        // bounds the forward edge so the feed body can't be inflated by a stray year-3000
        // event.
        capturedFilter.EndDateFrom.Should().NotBeNull();
        capturedFilter.EndDateFrom!.Value.Should().BeBefore(DateTime.UtcNow.AddDays(-89));
        capturedFilter.EndDateFrom.Value.Should().BeAfter(DateTime.UtcNow.AddDays(-91));
        capturedFilter.ToDate.Should().NotBeNull();
        capturedFilter.ToDate!.Value.Should().BeAfter(DateTime.UtcNow.AddYears(2).AddDays(-1));
    }

    private static Event CreatePublishedEvent(string title, EventVisibility visibility)
    {
        var evt = Event.Create(title, "desc", "Venue",
            DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(2));
        evt.SetVisibility(visibility);
        evt.Publish();
        return evt;
    }
}
