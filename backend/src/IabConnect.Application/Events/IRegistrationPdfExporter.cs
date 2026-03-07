using IabConnect.Domain.Events;

namespace IabConnect.Application.Events;

/// <summary>
/// Generates a PDF export of event registrations.
/// </summary>
public interface IRegistrationPdfExporter
{
    Task<byte[]> GenerateRegistrationListPdfAsync(
        Event evt,
        IReadOnlyList<EventRegistration> registrations,
        EventRegistrationStatistics statistics);
}
