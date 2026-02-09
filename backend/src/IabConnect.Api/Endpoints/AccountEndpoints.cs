using System.Security.Claims;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for financial account management (REQ-038)
/// </summary>
public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/accounts")
            .WithTags("Finance - Accounts");

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetAccounts")
            .WithSummary("List all financial accounts")
            .WithDescription("REQ-038: Returns all financial accounts.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateAccount")
            .WithSummary("Create a financial account")
            .WithDescription("REQ-038: Creates a new financial account. Audited.");

        group.MapPut("/{id:guid}", Update)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdateAccount")
            .WithSummary("Update a financial account")
            .WithDescription("REQ-038: Updates a financial account. Audited.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteAccount")
            .WithSummary("Delete a financial account")
            .WithDescription("REQ-038: Deletes a financial account. Audited.");
    }

    private static async Task<IResult> GetAll(
        IAccountRepository repository,
        CancellationToken ct)
    {
        var accounts = await repository.GetAllAsync(ct);
        var response = accounts.Select(a => new AccountResponse(
            a.Id, a.Name, a.Number, a.Type.ToString(), a.Description,
            a.IsActive, a.SortOrder, a.CreatedAt, a.CreatedBy, a.UpdatedAt, a.UpdatedBy));
        return Results.Ok(response);
    }

    private static async Task<IResult> Create(
        CreateAccountRequest request,
        IAccountRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        if (!Enum.TryParse<AccountType>(request.Type, true, out var accountType))
            return Results.BadRequest(new { Message = $"Invalid account type '{request.Type}'." });

        var account = Account.Create(
            request.Name, request.Number, accountType,
            request.Description, request.SortOrder, userName ?? "system");

        await repository.AddAsync(account, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Account '{account.Name}' ({account.Number}) created",
            entityType: "Account",
            entityId: account.Id.ToString(),
            ct: ct);

        return Results.Created($"/api/v1/finance/accounts/{account.Id}",
            new AccountResponse(account.Id, account.Name, account.Number, account.Type.ToString(),
                account.Description, account.IsActive, account.SortOrder,
                account.CreatedAt, account.CreatedBy, account.UpdatedAt, account.UpdatedBy));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateAccountRequest request,
        IAccountRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var account = await repository.GetByIdAsync(id, ct);
        if (account is null)
            return Results.NotFound(new { Message = "Account not found." });

        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        if (!Enum.TryParse<AccountType>(request.Type, true, out var accountType))
            return Results.BadRequest(new { Message = $"Invalid account type '{request.Type}'." });

        account.Update(request.Name, request.Number, accountType,
            request.Description, request.SortOrder, userName ?? "system");

        await repository.UpdateAsync(account, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Account '{account.Name}' ({account.Number}) updated",
            entityType: "Account",
            entityId: account.Id.ToString(),
            ct: ct);

        return Results.Ok(new AccountResponse(account.Id, account.Name, account.Number,
            account.Type.ToString(), account.Description, account.IsActive, account.SortOrder,
            account.CreatedAt, account.CreatedBy, account.UpdatedAt, account.UpdatedBy));
    }

    private static async Task<IResult> Delete(
        Guid id,
        IAccountRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        CancellationToken ct)
    {
        var account = await repository.GetByIdAsync(id, ct);
        if (account is null)
            return Results.NotFound(new { Message = "Account not found." });

        var accountName = account.Name;
        await repository.DeleteAsync(id, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Account '{accountName}' deleted",
            entityType: "Account",
            entityId: id.ToString(),
            ct: ct);

        return Results.NoContent();
    }

    // DTOs
    public sealed record CreateAccountRequest(string Name, string Number, string Type, string? Description, int SortOrder);
    public sealed record UpdateAccountRequest(string Name, string Number, string Type, string? Description, int SortOrder);
    public sealed record AccountResponse(Guid Id, string Name, string Number, string Type, string? Description,
        bool IsActive, int SortOrder, DateTime CreatedAt, string CreatedBy, DateTime? UpdatedAt, string? UpdatedBy);
}
