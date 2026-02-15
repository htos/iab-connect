using MediatR;

namespace IabConnect.Application.Finance.Categories.Commands;

/// <summary>
/// Command to soft-delete a transaction category (REQ-038)
/// </summary>
public sealed record DeleteCategoryCommand(Guid Id, string UserName) : IRequest<bool>;
