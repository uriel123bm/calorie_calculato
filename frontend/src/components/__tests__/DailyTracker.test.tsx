import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DailyTracker } from "../DailyTracker";
import type { DailyTrackerState } from "../../types";

describe("DailyTracker", () => {
  it("renders daily tracker data and manual add section", () => {
    const state: DailyTrackerState = {
      date: "2026-04-28",
      targetCalories: 2200,
      entries: [],
    };

    render(
      <DailyTracker
        state={state}
        setTarget={() => {}}
        addEntry={() => {}}
        removeEntry={() => {}}
        resetDay={() => {}}
      />
    );

    expect(screen.getByText("קלוריות היומיות")).toBeInTheDocument();
    expect(screen.getByText("הוסף ערך ידני")).toBeInTheDocument();
    expect(screen.getByLabelText("יעד יומי (קק\"ל):")).toBeInTheDocument();
  });
});
