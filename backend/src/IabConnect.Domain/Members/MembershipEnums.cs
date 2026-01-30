namespace IabConnect.Domain.Members;

/// <summary>
/// Membership status enumeration
/// </summary>
public enum MembershipStatus
{
    /// <summary>Pending approval</summary>
    Pending = 0,
    
    /// <summary>Active member</summary>
    Active = 1,
    
    /// <summary>Inactive member (voluntary)</summary>
    Inactive = 2,
    
    /// <summary>Suspended (e.g., unpaid fees)</summary>
    Suspended = 3
}

/// <summary>
/// Membership type enumeration
/// </summary>
public enum MembershipType
{
    /// <summary>Regular membership</summary>
    Regular = 0,
    
    /// <summary>Student membership (reduced fee)</summary>
    Student = 1,
    
    /// <summary>Family membership</summary>
    Family = 2,
    
    /// <summary>Honorary membership (no fee)</summary>
    Honorary = 3
}
