namespace IabConnect.Infrastructure.Storage;

/// <summary>
/// Configuration settings for S3-compatible document storage (RustFS)
/// </summary>
public class DocumentStorageSettings
{
    public const string SectionName = "DocumentStorage";

    public string ServiceUrl { get; set; } = "";
    public string AccessKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
    public string BucketName { get; set; } = "iabconnect-documents";
    public bool UseHttps { get; set; } = true;
}
