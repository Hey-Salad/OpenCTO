import Foundation

public enum CodebaseRunStatus: String, Codable, Sendable {
    case queued
    case running
    case succeeded
    case failed
    case canceled
    case timedOut = "timed_out"
}

public enum CodebaseRunApprovalState: String, Codable, Sendable {
    case notRequired = "not_required"
    case pending
    case approved
    case denied
}

public struct CodebaseRunApproval: Codable, Sendable {
    public let required: Bool
    public let state: CodebaseRunApprovalState
    public let reason: String?
    public let approvedByUserId: String?
    public let decidedAt: String?
}

public struct CodebaseRun: Codable, Sendable {
    public let id: String
    public let userId: String
    public let repoUrl: String
    public let repoFullName: String?
    public let baseBranch: String
    public let targetBranch: String
    public let status: CodebaseRunStatus
    public let requestedCommands: [String]
    public let commandAllowlistVersion: String
    public let timeoutSeconds: Int
    public let createdAt: String
    public let startedAt: String?
    public let completedAt: String?
    public let canceledAt: String?
    public let errorMessage: String?
    public let approval: CodebaseRunApproval?
}

public struct MutateCodebaseRunResponse: Codable, Sendable {
    public let run: CodebaseRun
}

public struct OpenCTOApiError: Codable, Error, Sendable {
    public let error: String
    public let code: String
    public let status: Int?
}
