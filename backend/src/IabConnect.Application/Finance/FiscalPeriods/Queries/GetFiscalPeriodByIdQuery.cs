using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Queries;

/// <summary>
/// REQ-066: Retrieves a single fiscal period by its ID.
/// </summary>
public sealed record GetFiscalPeriodByIdQuery(Guid Id) : IRequest<FiscalPeriodDto?>;
