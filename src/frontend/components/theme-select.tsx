"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ThemeSelect() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();

  const THEME_ITEMS = [
    { value: "light", label: t("light") },
    { value: "dark", label: t("dark") },
    { value: "system", label: t("system") },
  ];

  return (
    <Select
      items={THEME_ITEMS}
      // theme is undefined until next-themes reads the stored preference
      // after mount - default to "system" (this app's own ThemeProvider
      // default) rather than undefined. Select's controlled/uncontrolled
      // mode is locked in on the first render (see @base-ui/utils
      // useControlled), so ever passing undefined here would strand it in
      // uncontrolled mode and the label would never reflect later updates.
      value={theme ?? "system"}
      onValueChange={(next) => next && setTheme(next)}
    >
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {THEME_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
