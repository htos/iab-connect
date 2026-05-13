using IabConnect.Application.Common;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Members.Commands;

/// <summary>
/// Handler for CreateMemberCommand — creates a new member via MediatR pipeline
/// REQ-014: Mitglied erstellen
/// REQ-018 (E2.S2): Normalized-email duplicate guard via <see cref="IMemberRepository.GetByEmailNormalizedAsync"/>.
/// </summary>
public sealed class CreateMemberCommandHandler : IRequestHandler<CreateMemberCommand, Guid>
{
    private readonly IMemberRepository _memberRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDuplicateMatcher _duplicateMatcher;

    public CreateMemberCommandHandler(
        IMemberRepository memberRepository,
        IUnitOfWork unitOfWork,
        IDuplicateMatcher duplicateMatcher)
    {
        _memberRepository = memberRepository;
        _unitOfWork = unitOfWork;
        _duplicateMatcher = duplicateMatcher;
    }

    public async Task<Guid> Handle(CreateMemberCommand request, CancellationToken cancellationToken)
    {
        var existing = await _memberRepository.GetByEmailNormalizedAsync(request.Email, cancellationToken);
        if (existing is not null)
            throw new DuplicateMemberException(existing.Id, _duplicateMatcher.NormalizeEmail(request.Email));

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
