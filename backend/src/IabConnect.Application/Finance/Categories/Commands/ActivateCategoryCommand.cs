using IabConnect.Application.Finance.Categories.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Categories.Commands;

/// <summary>
/// Command to activate a transaction category (REQ-038)
/// </summary>
public sealed record ActivateCategoryCommand(Guid Id, string UserName) : IRequest<CategoryDto?>;
