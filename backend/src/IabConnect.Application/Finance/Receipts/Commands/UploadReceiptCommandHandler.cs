using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Receipts.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Receipts.Commands;

public sealed class UploadReceiptCommandHandler : IRequestHandler<UploadReceiptCommand, ReceiptDto>
{
    private readonly IReceiptRepository _repository;
    private readonly IFinanceDocumentStorage _documentStorage;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UploadReceiptCommandHandler(
        IReceiptRepository repository,
        IFinanceDocumentStorage documentStorage,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _documentStorage = documentStorage;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<ReceiptDto> Handle(UploadReceiptCommand request, CancellationToken ct)
    {
        var validation = _documentStorage.ValidateFile(request.FileName, request.ContentType, request.FileSize);
        if (!validation.IsValid)
            throw new InvalidOperationException(validation.ErrorMessage ?? "Invalid file.");

        var receipt = Receipt.Create(
            request.FileName,
            string.Empty,
            request.ContentType,
            request.FileSize,
            request.UserName,
            notes: request.Notes);

        var uploadResult = await _documentStorage.UploadReceiptAsync(
            receipt.Id, request.FileName, request.FileStream, request.ContentType, ct);

        receipt.SetStorageMetadata(uploadResult.StoragePath, uploadResult.FileHash, uploadResult.FileSize);

        await _repository.AddAsync(receipt, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Receipt '{receipt.FileName}' uploaded ({uploadResult.FileSize} bytes, hash: {uploadResult.FileHash})",
            entityType: "Receipt",
            entityId: receipt.Id.ToString(),
            ct: ct);

        return GetReceiptsQueryHandler.MapToDto(receipt);
    }
}
