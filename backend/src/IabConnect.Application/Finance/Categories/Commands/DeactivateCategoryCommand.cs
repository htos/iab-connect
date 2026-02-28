using IabConnect.Application.Finance.Categories.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Categories.Commands;

/// <summary>
/// Command to deactivate a transaction category (REQ-038)
/// </summary>
public sealed record DeactivateCategoryCommand(Guid Id, string UserName) : IRequest<CategoryDto?>;
