using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Accounting.JournalEntries.Queries;

/// <summary>
/// REQ-076: Query journal entries with filters.
/// </summary>
public sealed record GetJournalEntriesQuery : IRequest<List<JournalEntryDto>>
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public string? Status { get; init; }
}

public sealed class GetJournalEntriesQueryHandler : IRequestHandler<GetJournalEntriesQuery, List<JournalEntryDto>>
{
    private readonly IJournalEntryRepository _repository;
    private readonly IFinanceProfileRepository _profileRepo;

    public GetJournalEntriesQueryHandler(
        IJournalEntryRepository repository,
        IFinanceProfileRepository profileRepo)
    {
        _repository = repository;
        _profileRepo = profileRepo;
    }

    public async Task<List<JournalEntryDto>> Handle(GetJournalEntriesQuery request, CancellationToken ct)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct)
            ?? throw new InvalidOperationException("No active finance profile found.");

        JournalEntryStatus? status = null;
        if (!string.IsNullOrWhiteSpace(request.Status))
            status = Enum.Parse<JournalEntryStatus>(request.Status, ignoreCase: true);

        var entries = await _repository.GetAllAsync(profile.Id, request.From, request.To, status, ct);
        return entries.Select(AccountingDtoMapper.MapToDto).ToList();
    }
}

/// <summary>
/// REQ-076: Get a single journal entry with all lines.
/// </summary>
public sealed record GetJournalEntryByIdQuery(Guid Id) : IRequest<JournalEntryDto?>;

public sealed class GetJournalEntryByIdQueryHandler : IRequestHandler<GetJournalEntryByIdQuery, JournalEntryDto?>
{
    private readonly IJournalEntryRepository _repository;

    public GetJournalEntryByIdQueryHandler(IJournalEntryRepository repository)
    {
        _repository = repository;
    }

    public async Task<JournalEntryDto?> Handle(GetJournalEntryByIdQuery request, CancellationToken ct)
    {
        var entry = await _repository.GetByIdWithLinesAsync(request.Id, ct);
        return entry is null ? null : AccountingDtoMapper.MapToDto(entry);
    }
}

/// <summary>
/// REQ-083: Get journal entries linked to a specific source entity (Transaction, Payment, etc.)
/// </summary>
public sealed record GetJournalEntriesBySourceQuery(string SourceType, Guid SourceId) : IRequest<List<JournalEntryDto>>;

public sealed class GetJournalEntriesBySourceQueryHandler : IRequestHandler<GetJournalEntriesBySourceQuery, List<JournalEntryDto>>
{
    private readonly IJournalEntryRepository _repository;

    public GetJournalEntriesBySourceQueryHandler(IJournalEntryRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<JournalEntryDto>> Handle(GetJournalEntriesBySourceQuery request, CancellationToken ct)
    {
        var entries = await _repository.GetBySourceAsync(request.SourceType, request.SourceId, ct);
        return entries.Select(AccountingDtoMapper.MapToDto).ToList();
    }
}
