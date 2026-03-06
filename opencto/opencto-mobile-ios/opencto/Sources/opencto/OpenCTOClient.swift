import Foundation

public protocol OpenCTOAuthTokenProvider: Sendable {
    func bearerToken() async throws -> String
}

public struct StaticBearerTokenProvider: OpenCTOAuthTokenProvider {
    private let token: String

    public init(token: String) {
        self.token = token
    }

    public func bearerToken() async throws -> String {
        token
    }
}

public final class OpenCTOClient: @unchecked Sendable {
    public let baseURL: URL
    private let session: URLSession
    private let tokenProvider: OpenCTOAuthTokenProvider
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    public init(
        baseURL: URL = URL(string: "https://api.opencto.works")!,
        tokenProvider: OpenCTOAuthTokenProvider,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.tokenProvider = tokenProvider
        self.session = session
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    public func approveRun(runId: String, note: String? = nil) async throws -> MutateCodebaseRunResponse {
        let path = "/api/v1/codebase/runs/\(runId)/approve"
        return try await post(path: path, body: ["note": note ?? ""])
    }

    public func denyRun(runId: String, note: String? = nil) async throws -> MutateCodebaseRunResponse {
        let path = "/api/v1/codebase/runs/\(runId)/deny"
        return try await post(path: path, body: ["note": note ?? ""])
    }

    private func post<T: Decodable, B: Encodable>(path: String, body: B) async throws -> T {
        let token = try await tokenProvider.bearerToken()
        let data = try encoder.encode(body)
        let request = try makeRequest(path: path, method: "POST", token: token, body: data)
        let (responseData, response) = try await session.data(for: request)
        return try decodeResponse(data: responseData, response: response)
    }

    private func makeRequest(path: String, method: String, token: String, body: Data? = nil) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = body
        return request
    }

    private func decodeResponse<T: Decodable>(data: Data, response: URLResponse) throws -> T {
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        if (200..<300).contains(http.statusCode) {
            return try decoder.decode(T.self, from: data)
        }

        if let apiError = try? decoder.decode(OpenCTOApiError.self, from: data) {
            throw apiError
        }
        throw URLError(.badServerResponse)
    }
}
