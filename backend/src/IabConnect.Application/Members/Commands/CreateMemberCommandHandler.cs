using IabConnect.Application.Common;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Members.Commands;

/// <summary>
/// Handler for CreateMemberCommand — creates a new member via MediatR pipeline
/// REQ-014: Mitglied erstellen
/// </summary>
public sealed class CreateMemberCommandHandler : IRequestHandler<CreateMemberCommand, Guid>
{
    private readonly IMemberRepository _memberRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CreateMemberCommandHandler(
        IMemberRepository memberRepository,
        IUnitOfWork unitOfWork)
    {
        _memberRepository = memberRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Guid> Handle(CreateMemberCommand request, CancellationToken cancellationToken)
    {
        // Check for duplicate email
        if (await _memberRepository.EmailExistsAsync(request.Email, cancellationToken))
            throw new InvalidOperationException("E-Mail-Adresse bereits vergeben");

        var address = Address.Create(
            request.Street,
            request.City,
            request.PostalCode,
            request.Country);

        var domainMembershipType = (Domain.Members.MembershipType)(int)request.MembershipType;

        var member = Member.Create(
            request.FirstName,
            request.LastName,
            request.Email,
            address,
            domainMembershipType,
            request.Phone);

        await _memberRepository.AddAsync(member, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return member.Id;
    }
}
