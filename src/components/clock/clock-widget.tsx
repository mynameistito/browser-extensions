import { useEffect, useState } from "react";

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

/** Display the current local time and date. */
export const ClockWidget = () => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const currentDate = new Date(now);

  return (
    <>
      <p className="date-line">{dateFormatter.format(currentDate)}</p>
      <time className="clock" dateTime={currentDate.toISOString()}>
        {timeFormatter.format(currentDate)}
      </time>
    </>
  );
};
