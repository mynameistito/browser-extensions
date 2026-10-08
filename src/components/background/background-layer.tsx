import { Effect } from "effect";
import { useEffect, useMemo, useState } from "react";

import { usePreferences } from "@/components/preferences/preferences-provider";
import { loadBackgroundPhotos } from "@/lib/background-client";
import { chooseDailyBackground } from "@/lib/backgrounds";
import type { BackgroundPhoto } from "@/lib/backgrounds";

/** Display one cached, attributed Wikimedia landscape behind the dashboard. */
export const BackgroundLayer = () => {
  const { preferences, isLoaded } = usePreferences();
  const [photos, setPhotos] = useState<readonly BackgroundPhoto[]>([]);
  const [loadedDay, setLoadedDay] = useState<number | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState("");

  useEffect(() => {
    if (!isLoaded || !preferences.backgroundEnabled) {
      return;
    }

    let isMounted = true;

    Effect.runFork(
      Effect.either(loadBackgroundPhotos()).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            if (isMounted && result._tag === "Right") {
              setPhotos(result.right);
              setLoadedDay(Date.now());
            }
          })
        )
      )
    );

    return () => {
      isMounted = false;
    };
  }, [isLoaded, preferences.backgroundEnabled]);

  const photo = useMemo(
    () =>
      loadedDay === null
        ? null
        : chooseDailyBackground(
            photos,
            loadedDay,
            preferences.backgroundChangeNonce
          ),
    [photos, loadedDay, preferences.backgroundChangeNonce]
  );

  if (
    !preferences.backgroundEnabled ||
    !photo ||
    failedImageUrl === photo.imageUrl
  ) {
    return null;
  }

  return (
    <div className="background-layer">
      <img
        alt=""
        className="background-image"
        onError={() => setFailedImageUrl(photo.imageUrl)}
        src={photo.imageUrl}
      />
      <div aria-hidden="true" className="background-scrim" />
      <p className="background-credit">
        Photo:{" "}
        <a href={photo.pageUrl} rel="noreferrer" target="_blank">
          {photo.title}
        </a>
        {" by "}
        {photo.artist}
        {" · "}
        <a href={photo.licenseUrl} rel="noreferrer" target="_blank">
          {photo.license}
        </a>
      </p>
    </div>
  );
};
