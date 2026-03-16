from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AgentProfile:
    slug: str
    title: str
    system_suffix: str


AGENT_PROFILES: dict[str, AgentProfile] = {
    'dispatch': AgentProfile(
        slug='dispatch',
        title='Dispatch Agent',
        system_suffix=(
            'You are the live dispatch agent for OpenCTO. Keep the conversation moving, '
            'summarize user intent, and delegate to tools when external state is required.'
        ),
    ),
    'repo': AgentProfile(
        slug='repo',
        title='Repo Agent',
        system_suffix=(
            'You are the repository specialist for OpenCTO. Focus on codebase, GitHub, '
            'branch, pull request, and workflow inspection tasks.'
        ),
    ),
    'deploy': AgentProfile(
        slug='deploy',
        title='Deploy Agent',
        system_suffix=(
            'You are the deployment specialist for OpenCTO. Focus on Vercel, Cloudflare, '
            'release status, incidents, and rollout readiness.'
        ),
    ),
    'incident': AgentProfile(
        slug='incident',
        title='Incident Agent',
        system_suffix=(
            'You are the incident response specialist for OpenCTO. Prioritize safety, '
            'status clarity, risk triage, and explicit next actions.'
        ),
    ),
}


def resolve_agent_profile(slug: str) -> AgentProfile:
    normalized = slug.strip().lower() or 'dispatch'
    return AGENT_PROFILES.get(normalized, AGENT_PROFILES['dispatch'])


def compose_system_instruction(base_instruction: str, profile_slug: str) -> str:
    profile = resolve_agent_profile(profile_slug)
    base = base_instruction.strip()
    if not base:
        base = 'You are an OpenCTO Google Live agent.'
    return f'{base}\n\nActive specialist: {profile.title}.\n{profile.system_suffix}'


def build_tool_declarations() -> list[dict]:
    return [
        {
            'name': 'list_vercel_projects',
            'description': 'List all Vercel projects in this account',
            'parameters': {'type': 'object', 'properties': {}, 'required': []},
        },
        {
            'name': 'list_vercel_deployments',
            'description': 'List the most recent deployments for a Vercel project',
            'parameters': {
                'type': 'object',
                'properties': {
                    'projectId': {'type': 'string', 'description': 'Vercel project name or ID'},
                },
                'required': ['projectId'],
            },
        },
        {
            'name': 'get_vercel_deployment',
            'description': 'Get details and status of a specific Vercel deployment',
            'parameters': {
                'type': 'object',
                'properties': {
                    'deploymentId': {'type': 'string', 'description': 'Vercel deployment ID'},
                },
                'required': ['deploymentId'],
            },
        },
        {
            'name': 'list_cloudflare_workers',
            'description': 'List all Cloudflare Workers scripts in the account',
            'parameters': {'type': 'object', 'properties': {}, 'required': []},
        },
        {
            'name': 'list_cloudflare_pages',
            'description': 'List all Cloudflare Pages projects',
            'parameters': {'type': 'object', 'properties': {}, 'required': []},
        },
        {
            'name': 'get_cloudflare_worker_usage',
            'description': 'Get CPU time and request metrics for a specific Cloudflare Worker',
            'parameters': {
                'type': 'object',
                'properties': {
                    'scriptName': {'type': 'string', 'description': 'Cloudflare Worker script name'},
                },
                'required': ['scriptName'],
            },
        },
        {
            'name': 'list_openai_models',
            'description': 'List all available OpenAI models',
            'parameters': {'type': 'object', 'properties': {}, 'required': []},
        },
        {
            'name': 'get_openai_usage',
            'description': 'Get OpenAI API usage and token costs for a date range',
            'parameters': {
                'type': 'object',
                'properties': {
                    'startDate': {'type': 'string', 'description': 'Start date YYYY-MM-DD'},
                    'endDate': {'type': 'string', 'description': 'End date YYYY-MM-DD'},
                },
                'required': ['startDate', 'endDate'],
            },
        },
        {
            'name': 'list_github_orgs',
            'description': 'List GitHub organizations available to the authenticated token',
            'parameters': {'type': 'object', 'properties': {}, 'required': []},
        },
        {
            'name': 'list_github_repos',
            'description': 'List repositories in a GitHub organization',
            'parameters': {
                'type': 'object',
                'properties': {
                    'org': {'type': 'string', 'description': 'GitHub organization login'},
                },
                'required': ['org'],
            },
        },
        {
            'name': 'list_github_pull_requests',
            'description': 'List recent pull requests for a repository',
            'parameters': {
                'type': 'object',
                'properties': {
                    'owner': {'type': 'string', 'description': 'Repository owner or organization'},
                    'repo': {'type': 'string', 'description': 'Repository name'},
                },
                'required': ['owner', 'repo'],
            },
        },
        {
            'name': 'list_github_actions_runs',
            'description': 'List recent GitHub Actions workflow runs for a repository',
            'parameters': {
                'type': 'object',
                'properties': {
                    'owner': {'type': 'string', 'description': 'Repository owner or organization'},
                    'repo': {'type': 'string', 'description': 'Repository name'},
                },
                'required': ['owner', 'repo'],
            },
        },
    ]
