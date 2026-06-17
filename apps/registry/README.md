# `@iris/registry` (deferred)

> **Status: deferred. Not part of the MVP.** This directory is a placeholder for
> the reference **registry server**. There is no runnable server here yet.

Iris knows every capability you own and hands the right one to whatever agent
you're working with. The registry is how that library becomes _portable across
people and machines_: a place to publish, discover, and resolve skills by name.

## What this will be

A reference, self-hostable registry server that handles:

- **Namespaced resolution** — resolving `@namespace/skill` identifiers to a
  concrete skill version.
- **Fetch** — downloading a published skill (and its reference files) into a
  local library.
- **Publish** — uploading a skill from a local library to the registry.

It pairs with the [`@iris/registry-client`](../../packages/registry-client)
package, which is currently a stub. The client defines the protocol surface; this
server will be the open reference implementation behind it.

## Scope and the open-core boundary

Per Iris's open-core boundary, **hosted/cloud registry features** (managed
hosting, accounts, access control, search-at-scale, and other operational
concerns) live in a **separate private repository**. What lands here is limited
to the open reference implementation of the registry protocol — enough to run
your own and to keep the protocol verifiable in the open.

Until this milestone is picked up, build and share libraries directly with the
`iris` CLI (`iris init`, `iris add`, `iris sync`) and the bundled
[`skills/`](../../skills) folder.

See the root `README.md` and
[`spec/skill-access-protocol.md`](../../spec/skill-access-protocol.md) for the
protocol context.
