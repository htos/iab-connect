using FluentAssertions;
using IabConnect.Application.Events.Volunteers;
using Xunit;

namespace IabConnect.Application.Tests.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3) AC-9: privacy bound on <see cref="EventVolunteerAssignmentDto"/>.
/// Mirrors <c>FindMemberDuplicatesQueryHandlerTests.Handle_DtoOmitsPhoneAndAddressAndKeycloakId</c>
/// from the Member-duplicate work.
/// </summary>
public sealed class EventVolunteerAssignmentDtoPrivacyTests
{
    private static readonly string[] ProhibitedPropertyNames =
    {
        "Email",
        "Phone",
        "PhoneNumber",
        "Address",
        "Street",
        "City",
        "PostalCode",
        "KeycloakUserId",
        "AssignedBy",          // manager identity is not member-facing
        "FirstName",           // only the joined DisplayName is exposed
        "LastName",
    };

    [Fact]
    public void Dto_DoesNotExposeProhibitedMemberFields()
    {
        var properties = typeof(EventVolunteerAssignmentDto).GetProperties().Select(p => p.Name).ToList();

        foreach (var banned in ProhibitedPropertyNames)
        {
            properties.Should().NotContain(banned,
                $"EventVolunteerAssignmentDto must not expose '{banned}' to API consumers");
        }
    }

    [Fact]
    public void Dto_ExposesDisplayName()
    {
        var properties = typeof(EventVolunteerAssignmentDto).GetProperties().Select(p => p.Name).ToList();
        properties.Should().Contain("MemberDisplayName");
    }
}
