using FluentValidation;
using IabConnect.Domain.Events;
using MediatR;

namespace IabConnect.Application.Events.Fees.Commands;

/// <summary>
/// REQ-022 (E4-S1): Create a fee category on an event.
/// <paramref name="Currency"/> is a 3-letter ISO code; <paramref name="Applicability"/> is a
/// <see cref="FeeApplicability"/> name (Everyone / MembersOnly / PublicOnly).
/// </summary>
public sealed record CreateEventFeeCategoryCommand(
    Guid EventId,
    string Name,
    string? Description,
    decimal Amount,
    string Currency,
    string Applicability,
    DateTime? AvailableFrom,
    DateTime? AvailableUntil,
    int? MaxQuantity,
    Guid CreatedBy) : IRequest<EventFeeCategoryDto>;

public sealed class CreateEventFeeCategoryCommandValidator : AbstractValidator<CreateEventFeeCategoryCommand>
{
    public CreateEventFeeCategoryCommandValidator()
    {
        RuleFor(x => x.EventId).NotEqual(Guid.Empty);
        RuleFor(x => x.CreatedBy).NotEqual(Guid.Empty);
        RuleFor(x => x.Name)
            .NotEmpty()
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Name is required.")
            .MaximumLength(EventFeeCategory.NameMaxLength);
        RuleFor(x => x.Description).MaximumLength(EventFeeCategory.DescriptionMaxLength);
        RuleFor(x => x.Amount)
            .GreaterThanOrEqualTo(0)
            .Must(a => decimal.Round(a, 2) == a).WithMessage("Amount cannot have more than 2 decimal places.");
        RuleFor(x => x.Currency)
            .Must(FeeCurrencies.IsSupported)
            .WithMessage($"Currency must be one of: {FeeCurrencies.SupportedList}.");
        RuleFor(x => x.Applicability)
            .Must(FeeApplicabilityParsing.IsValid)
            .WithMessage("Applicability must be one of: Everyone, MembersOnly, PublicOnly.");
        RuleFor(x => x.MaxQuantity).GreaterThanOrEqualTo(1).When(x => x.MaxQuantity.HasValue);
        RuleFor(x => x)
            .Must(x => !(x.AvailableFrom.HasValue && x.AvailableUntil.HasValue) || x.AvailableUntil > x.AvailableFrom)
            .WithMessage("AvailableUntil must be after AvailableFrom.");
    }
}

public sealed class CreateEventFeeCategoryCommandHandler
    : IRequestHandler<CreateEventFeeCategoryCommand, EventFeeCategoryDto>
{
    private readonly IEventFeeCategoryRepository _categories;
    private readonly IEventRepository _events;

    public CreateEventFeeCategoryCommandHandler(
        IEventFeeCategoryRepository categories,
        IEventRepository events)
    {
        _categories = categories;
        _events = events;
    }

    public async Task<EventFeeCategoryDto> Handle(CreateEventFeeCategoryCommand request, CancellationToken cancellationToken)
    {
        _ = await _events.GetByIdAsync(request.EventId, cancellationToken)
            ?? throw new KeyNotFoundException($"Event {request.EventId} not found.");

        if (await _categories.ActiveNameExistsAsync(request.EventId, request.Name, excludingId: null, cancellationToken))
            throw new InvalidOperationException($"An active fee category named '{request.Name.Trim()}' already exists for this event.");

        var applicability = FeeApplicabilityParsing.Parse(request.Applicability);
        var category = EventFeeCategory.Create(
            request.EventId, request.Name, request.Amount, request.Currency, applicability,
            request.CreatedBy, request.Description, request.AvailableFrom, request.AvailableUntil, request.MaxQuantity);

        await _categories.AddAsync(category, cancellationToken);
        return EventFeeCategoryDto.FromEntity(category);
    }
}
