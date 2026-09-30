import { Effect } from "effect";
import { useState } from "react";
import type { FormEvent } from "react";

import { usePreferences } from "@/components/preferences/preferences-provider";
import { createSearchUrl } from "@/lib/search";
import type { SearchTarget } from "@/lib/search";

/** Search the web or open a query as a ChatGPT prompt. */
export const SearchWidget = () => {
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const { preferences, isLoaded } = usePreferences();

  const submitSearch = (target: SearchTarget) => {
    const program = createSearchUrl(
      target,
      query,
      preferences.searchProvider
    ).pipe(
      Effect.flatMap((url) =>
        Effect.sync(() => {
          window.open(url.toString(), "_blank", "noopener,noreferrer");
        })
      ),
      Effect.either
    );

    const result = Effect.runSync(program);

    if (result._tag === "Left") {
      setSearchError("Enter a search first.");
      return;
    }

    setSearchError("");
  };

  const handleWebSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch("web");
  };

  return (
    <form className="search-form" onSubmit={handleWebSearch}>
      <label className="sr-only" htmlFor="search-query">
        Search the web or ask ChatGPT
      </label>
      <input
        autoComplete="off"
        autoCorrect="off"
        id="search-query"
        name="q"
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="What are you looking for?"
        spellCheck={false}
        type="search"
        value={query}
      />
      <div className="search-actions">
        <button
          className="search-button search-button-primary"
          disabled={!isLoaded}
          type="submit"
        >
          Search web
        </button>
        <button
          className="search-button search-button-secondary"
          disabled={!isLoaded}
          onClick={() => submitSearch("chatgpt")}
          type="button"
        >
          Ask ChatGPT
        </button>
      </div>
      <p aria-live="polite" className="search-message">
        {searchError ||
          `${preferences.searchProvider === "duckduckgo" ? "DuckDuckGo" : preferences.searchProvider} · ChatGPT prompt`}
      </p>
    </form>
  );
};
