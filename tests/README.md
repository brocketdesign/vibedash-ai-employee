# Tests

Two suites, no test framework — plain scripts run with `tsx`, so they work
without adding a runner to the dependency tree.

## `employee-units.ts`

Pure logic, no I/O: JSON extraction from model output, path-traversal and
subdomain guards, slug generation, email validation, and the invariants of the
manager registry (unique ids, valid task kinds, well-formed tool schemas,
capability gating).

```bash
npm run test:units
```

Nothing in this suite connects to a database, so it needs no environment
variables.

## `employee-e2e.ts`

The real night shift, end to end, against a live MongoDB and a stub Novita
endpoint it starts itself on port 8791. Covers: activating a subscription →
creating a company (profile drafted by the model) → planning a backlog →
running a shift → a verified task with an artifact → the filed document, the
activity ticker and the morning report → shift/credit metering → knowledge
accumulation → backlog refill.

It needs a MongoDB it can write to. A throwaway one:

```bash
mkdir -p /tmp/vibedash-test-db
mongod --dbpath /tmp/vibedash-test-db --port 27099 &
MONGODB_URI=mongodb://127.0.0.1:27099/vibedash_test npm run test:e2e
```

The suite creates a uniquely-named test user and deletes its data on the way
out, so it is safe to point at a scratch database.

Neither suite calls a real model, a real sandbox, or a real VPS — no API keys,
no spend.
