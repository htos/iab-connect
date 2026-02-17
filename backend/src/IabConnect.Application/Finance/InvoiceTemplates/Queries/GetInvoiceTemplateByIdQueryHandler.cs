using MediatR;

namespace IabConnect.Application.Finance.InvoiceTemplates.Queries;

public sealed class GetInvoiceTemplateByIdQueryHandler : IRequestHandler<GetInvoiceTemplateByIdQuery, InvoiceTemplateDto?>
{
    private readonly IInvoiceTemplateRepository _repository;

    public GetInvoiceTemplateByIdQueryHandler(IInvoiceTemplateRepository repository)
    {
        _repository = repository;
    }

    public async Task<InvoiceTemplateDto?> Handle(GetInvoiceTemplateByIdQuery request, CancellationToken ct)
    {
        var template = await _repository.GetByIdAsync(request.Id, ct);
        return template is null ? null : GetInvoiceTemplatesQueryHandler.MapToDto(template);
    }
}
