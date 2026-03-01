using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using FluentValidation;
using MediatR;

namespace IabConnect.Application.Finance.Accounting.PostingMappings;

// ─── Get All ───

public sealed record GetPostingMappingsQuery : IRequest<List<PostingMappingDto>>;

public sealed class GetPostingMappingsQueryHandler : IRequestHandler<GetPostingMappingsQuery, List<PostingMappingDto>>
{
    private readonly IPostingMappingRepository _repository;
    private readonly IFinanceProfileRepository _profileRepo;

    public GetPostingMappingsQueryHandler(
        IPostingMappingRepository repository,
        IFinanceProfileRepository profileRepo)
    {
        _repository = repository;
        _profileRepo = profileRepo;
    }

    public async Task<List<PostingMappingDto>> Handle(GetPostingMappingsQuery request, CancellationToken ct)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct)
            ?? throw new InvalidOperationException("No active finance profile found.");

        var mappings = await _repository.GetAllByProfileAsync(profile.Id, ct);
        return mappings.Select(AccountingDtoMapper.MapToDto).ToList();
    }
}

// ─── Create ───

public sealed record CreatePostingMappingCommand : IRequest<PostingMappingDto>
{
    public required string MappingType { get; init; }
    public required Guid SourceId { get; init; }
    public required Guid LedgerAccountId { get; init; }
    public Guid? TaxLedgerAccountId { get; init; }
    public required string UserName { get; init; }
}

public sealed class CreatePostingMappingCommandValidator : AbstractValidator<CreatePostingMappingCommand>
{
    public CreatePostingMappingCommandValidator()
    {
        RuleFor(x => x.MappingType).NotEmpty().Must(v => Enum.TryParse<PostingMappingType>(v, true, out _))
            .WithMessage("MappingType must be Category, Account, or TaxCode.");
        RuleFor(x => x.SourceId).NotEmpty();
        RuleFor(x => x.LedgerAccountId).NotEmpty();
        RuleFor(x => x.UserName).NotEmpty();
    }
}

public sealed class CreatePostingMappingCommandHandler : IRequestHandler<CreatePostingMappingCommand, PostingMappingDto>
{
    private readonly IPostingMappingRepository _repository;
    private readonly IFinanceProfileRepository _profileRepo;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreatePostingMappingCommandHandler(
        IPostingMappingRepository repository,
        IFinanceProfileRepository profileRepo,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _profileRepo = profileRepo;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<PostingMappingDto> Handle(CreatePostingMappingCommand request, CancellationToken ct)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct)
            ?? throw new InvalidOperationException("No active finance profile found.");

        var mappingType = Enum.Parse<PostingMappingType>(request.MappingType, ignoreCase: true);

        // Check for duplicate
        var existing = await _repository.GetBySourceAsync(profile.Id, mappingType, request.SourceId, ct);
        if (existing is not null)
            throw new InvalidOperationException($"A posting mapping for this source already exists (Id: {existing.Id}).");

        var mapping = PostingMapping.Create(
            profile.Id, mappingType, request.SourceId,
            request.LedgerAccountId, request.UserName, request.TaxLedgerAccountId);

        await _repository.AddAsync(mapping, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Posting mapping ({mappingType}) created for source {request.SourceId}",
            entityType: "PostingMapping",
            entityId: mapping.Id.ToString(),
            ct: ct);

        return AccountingDtoMapper.MapToDto(mapping);
    }
}

// ─── Update ───

public sealed record UpdatePostingMappingCommand : IRequest<PostingMappingDto?>
{
    public required Guid Id { get; init; }
    public required Guid LedgerAccountId { get; init; }
    public Guid? TaxLedgerAccountId { get; init; }
    public required string UserName { get; init; }
}

public sealed class UpdatePostingMappingCommandHandler : IRequestHandler<UpdatePostingMappingCommand, PostingMappingDto?>
{
    private readonly IPostingMappingRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdatePostingMappingCommandHandler(
        IPostingMappingRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<PostingMappingDto?> Handle(UpdatePostingMappingCommand request, CancellationToken ct)
    {
        var mapping = await _repository.GetByIdAsync(request.Id, ct);
        if (mapping is null) return null;

        mapping.Update(request.LedgerAccountId, request.UserName, request.TaxLedgerAccountId);

        await _repository.UpdateAsync(mapping, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Posting mapping ({mapping.MappingType}) updated",
            entityType: "PostingMapping",
            entityId: mapping.Id.ToString(),
            ct: ct);

        return AccountingDtoMapper.MapToDto(mapping);
    }
}

// ─── Delete ───

public sealed record DeletePostingMappingCommand : IRequest<bool>
{
    public required Guid Id { get; init; }
}

public sealed class DeletePostingMappingCommandHandler : IRequestHandler<DeletePostingMappingCommand, bool>
{
    private readonly IPostingMappingRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeletePostingMappingCommandHandler(
        IPostingMappingRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(DeletePostingMappingCommand request, CancellationToken ct)
    {
        var mapping = await _repository.GetByIdAsync(request.Id, ct);
        if (mapping is null) return false;

        await _repository.DeleteAsync(request.Id, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Posting mapping ({mapping.MappingType}) deleted",
            entityType: "PostingMapping",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}
