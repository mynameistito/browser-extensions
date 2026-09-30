import { Effect } from "effect";
import { useEffect, useMemo, useState } from "react";

import { loadBackgroundPhotos } from "../../lib/background-client";
import { chooseDailyBackground } from "../../lib/backgrounds";
import type { BackgroundPhoto } from "../../lib/backgrounds";
import { usePreferences } from "../preferences/preferences-provider";

/** Display one cached, attributed Wikimedia landscape behind the dashboard. */
export const BackgroundLayer = () => {
  const { preferences } = usePreferences();
  const [photos, setPhotos] = useState<readonly BackgroundPhoto[]>([]);
  const [loadedDay, setLoadedDay] = useState<number | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState("");

  useEffect(() => {
    if (!preferences.backgroundEnabled) {
      return;
    }

    let isMounted = true;

    const load = async () => {
      const result = await Effect.runPromise(
        Effect.either(loadBackgroundPhotos())
      );

      if (isMounted && result._tag === "Right") {
        setPhotos(result.right);
        setLoadedDay(Date.now());
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [preferences.backgroundEnabled]);

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
