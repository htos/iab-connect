using FluentValidation;
using IabConnect.Domain.Integration;

namespace IabConnect.Application.Integration.Commands;

/// <summary>REQ-058 (E8-S1, AC-1/3): validator for <see cref="CreateApiClientCommand"/>.</summary>
public sealed class CreateApiClientCommandValidator : AbstractValidator<CreateApiClientCommand>
{
    public CreateApiClientCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("API client name is required.")
            .MaximumLength(200);

        RuleFor(x => x.Scopes)
            .NotEmpty().WithMessage("At least one scope must be granted.");

        RuleForEach(x => x.Scopes)
            .Must(s => ApiScopes.All.Contains(s))
            .WithMessage(s => $"Unknown API scope '{s}'. Valid scopes: {string.Join(", ", ApiScopes.All)}.");
    }
}
