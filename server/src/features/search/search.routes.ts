import { Router } from "express";

import { currentUser } from "@/middleware/auth";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl } from "@/lib/cache/tags";

import { isSearchableQuery, normalizeQuery } from "./lib/search-text";
import * as searchService from "./services/search-service";
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from "./types";

export const searchRouter = Router();

const MAX_LIMIT_PER_TYPE = 50;

/**
 * Global search (the Ctrl/Cmd+K dialog and the /search page). Results are
 * scoped by the service to what the viewer can see, cached briefly per
 * viewer and query.
 */
searchRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const query = normalizeQuery(typeof req.query.q === "string" ? req.query.q : "");
  if (!isSearchableQuery(query)) {
    res.json(searchService.emptyResults(query));
    return;
  }

  const rawTypes = typeof req.query.types === "string" ? req.query.types.split(",") : [];
  const entityTypes = rawTypes.filter((type): type is SearchEntityType =>
    SEARCH_ENTITY_TYPES.includes(type as SearchEntityType),
  );
  const rawLimit = Number(req.query.limitPerType);
  const limitPerType =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT_PER_TYPE) : undefined;

  const filters = {
    query,
    entityTypes: entityTypes.length > 0 ? entityTypes : undefined,
    limitPerType,
  };
  const results = await cached(
    `search:${user.id}:${user.role}:${JSON.stringify(filters)}`,
    { ttl: CacheTtl.LIVE, tags: [CacheTags.ACADEMIC, CacheTags.AGGREGATES] },
    () => searchService.search(user, filters),
  );
  res.json(results);
});
