# Domain Setup for `opencto.works`

## Prerequisites
- Confirm the Raspberry Pi deployment is ready and any required SSH/DNS credentials are available.
- Identify the Cloudflare account that will manage `opencto.works` and gather the nameserver pair provided by Cloudflare.

## Namecheap → Cloudflare nameserver cutover
1. Sign in to Namecheap, open **Domain List**, and select `opencto.works`.
2. Under **Nameservers**, switch to **Custom DNS** and paste Cloudflare’s assigned nameservers (for example `aria.ns.cloudflare.com` and `noah.ns.cloudflare.com`).
3. Save the change and monitor the **Pending** state until it becomes **Active**. TTL is typically 1800 seconds, so allow 30 minutes for propagation.
4. Run `dig NS opencto.works +short` or Cloudflare’s diagnostics to confirm the nameservers match the Cloudflare pair.

## Cloudflare onboarding
1. Add the `opencto.works` zone if it is not already present.
2. Verify Cloudflare Imported DNS records against `CLOUDFLARE_DNS_PLAN.md`.
3. Enable Full (strict) SSL/TLS mode and ensure certificates are in place for every CNAME target.
4. Configure the redirect rules and always-on HTTPS from `WEB_DEPLOYMENT.md`.
5. If the Raspberry Pi cluster uses dynamic IPs, confirm origin IP whitelists or tunnels remain intact.

## Verification
- Wait for Cloudflare’s status to show **Active** with **DNSSEC** (optional) and no errors.
- Confirm `https://opencto.works` resolves to the landing page in multiple regions.
- Validate the TLS certificate served by Cloudflare shows **Full (strict)** and is marked as **Active** before handing off.
