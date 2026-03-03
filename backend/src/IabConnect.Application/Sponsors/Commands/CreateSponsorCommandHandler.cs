using IabConnect.Application.Common;
using IabConnect.Domain.Sponsors;
using MediatR;

namespace IabConnect.Application.Sponsors.Commands;

public sealed class CreateSponsorCommandHandler : IRequestHandler<CreateSponsorCommand, Guid>
{
    private readonly ISponsorRepository _sponsorRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CreateSponsorCommandHandler(
        ISponsorRepository sponsorRepository,
        IUnitOfWork unitOfWork)
    {
        _sponsorRepository = sponsorRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Guid> Handle(CreateSponsorCommand request, CancellationToken cancellationToken)
    {
        if (await _sponsorRepository.CompanyNameExistsAsync(request.CompanyName, ct: cancellationToken))
            throw new InvalidOperationException("A sponsor with this company name already exists");

        var sponsor = Sponsor.Create(
            request.CompanyName,
            request.ContactPerson,
            request.Email,
            request.Phone,
            request.Website,
            request.Street,
            request.City,
            request.PostalCode,
            request.Country,
            request.Tier,
            request.Notes,
            request.AgreementStart,
            request.AgreementEnd);

        await _sponsorRepository.AddAsync(sponsor, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return sponsor.Id;
    }
}
