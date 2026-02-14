namespace IabConnect.Infrastructure.Storage;

/// <summary>
/// Configuration settings for S3-compatible document storage (RustFS)
/// </summary>
public class DocumentStorageSettings
{
    public const string SectionName = "DocumentStorage";

    public string ServiceUrl { get; set; } = "http://localhost:9000";
    public string AccessKey { get; set; } = "rustfsadmin";
    public string SecretKey { get; set; } = "rustfsadmin";
    public string BucketName { get; set; } = "iabconnect-documents";
    public bool UseHttps { get; set; } = false;
}
