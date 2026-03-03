using IabConnect.Application.Common;
using IabConnect.Domain.Sponsors;
using MediatR;

namespace IabConnect.Application.Sponsors.Commands;

public sealed class CreateSupplierCommandHandler : IRequestHandler<CreateSupplierCommand, Guid>
{
    private readonly ISupplierRepository _supplierRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CreateSupplierCommandHandler(
        ISupplierRepository supplierRepository,
        IUnitOfWork unitOfWork)
    {
        _supplierRepository = supplierRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Guid> Handle(CreateSupplierCommand request, CancellationToken cancellationToken)
    {
        if (await _supplierRepository.CompanyNameExistsAsync(request.CompanyName, ct: cancellationToken))
            throw new InvalidOperationException("A supplier with this company name already exists");

        var supplier = Supplier.Create(
            request.CompanyName,
            request.ContactPerson,
            request.Email,
            request.Phone,
            request.Website,
            request.Street,
            request.City,
            request.PostalCode,
            request.Country,
            request.Category,
            request.Notes);

        await _supplierRepository.AddAsync(supplier, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return supplier.Id;
    }
}
