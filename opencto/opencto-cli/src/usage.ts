export const USAGE = `opencto CLI

Commands:
  opencto login [--workspace <key>] [--api-base-url <url>] [--auth-base-url <url>]
  opencto run --repo-url <url> --command <cmd> [--command <cmd>] [--wait]
  opencto agent start --broker-url <url> --agent-id <id> [--role <role>] [--no-auto-complete]
  opencto workflow list
  opencto workflow run <workflow-id> --repo-url <url> [--wait] [--var key=value]
  opencto workflow run custom --repo-url <url> --template <cmd> [--template <cmd>] [--wait]

Global flags:
  --workspace <key>
  --token-path <path>
  --workflows-file <path>
  --token <access_token>
  --help
`
