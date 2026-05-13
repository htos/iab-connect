using FluentAssertions;
using IabConnect.Domain.Events.Volunteers;
using Xunit;

namespace IabConnect.Application.Tests.Events.Volunteers;

public sealed class EventVolunteerRoleTests
{
    private readonly Guid _eventId = Guid.NewGuid();
    private readonly Guid _createdBy = Guid.NewGuid();

    [Fact]
    public void Create_TrimsAndPersistsName()
    {
        var role = EventVolunteerRole.Create(_eventId, "  Greeter  ", "  desc  ", _createdBy);

        role.Name.Should().Be("Greeter");
        role.Description.Should().Be("desc");
        role.IsActive.Should().BeTrue();
        role.EventId.Should().Be(_eventId);
        role.CreatedBy.Should().Be(_createdBy);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_BlankName_Throws(string? name)
    {
        Action act = () => EventVolunteerRole.Create(_eventId, name!, null, _createdBy);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_NameOverMaxLength_Throws()
    {
        var longName = new string('a', EventVolunteerRole.NameMaxLength + 1);
        Action act = () => EventVolunteerRole.Create(_eventId, longName, null, _createdBy);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Rename_UpdatesNameAndStampsUpdatedAt()
    {
        var role = EventVolunteerRole.Create(_eventId, "First", null, _createdBy);

        role.Rename("Second");

        role.Name.Should().Be("Second");
        role.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void DeactivateThenActivate_TogglesState()
    {
        var role = EventVolunteerRole.Create(_eventId, "Role", null, _createdBy);

        role.Deactivate();
        role.IsActive.Should().BeFalse();
        role.UpdatedAt.Should().NotBeNull();

        role.Activate();
        role.IsActive.Should().BeTrue();
    }
}
