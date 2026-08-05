"use client";

/**
 * The client boundary for the whole component library.
 *
 * Every interactive SeaKim component keeps hover, press, and selection state
 * internally, so all of them are Client Components. This one directive marks
 * everything re-exported below, which is why no component file carries its own —
 * the shared library never has to know that Next exists.
 *
 * Imports here are RELATIVE on purpose. That makes this file work unchanged in
 * both consumption models: installed from git into node_modules, or copied into
 * an app and reached through a path alias.
 *
 *     import { Button, Field, Input } from "@seakim/design-system";
 *
 * GENERATED-ADJACENT: keep in step with next/lib/seakim.ts, which re-exports
 * this file. `node tool/conformance-check.mjs` fails if a component in
 * components/ is missing from it.
 */

export { Icon } from "./components/core/Icon.jsx";
export { Button } from "./components/core/Button.jsx";
export { IconButton } from "./components/core/IconButton.jsx";
export { Badge } from "./components/core/Badge.jsx";
export { Tag } from "./components/core/Tag.jsx";
export { Card } from "./components/core/Card.jsx";
export { Avatar } from "./components/core/Avatar.jsx";
export { Stat } from "./components/core/Stat.jsx";
export { Field } from "./components/forms/Field.jsx";
export { Input } from "./components/forms/Input.jsx";
export { Textarea } from "./components/forms/Textarea.jsx";
export { Select } from "./components/forms/Select.jsx";
export { Checkbox } from "./components/forms/Checkbox.jsx";
export { Radio } from "./components/forms/Radio.jsx";
export { Switch } from "./components/forms/Switch.jsx";
export { SegmentedControl } from "./components/forms/SegmentedControl.jsx";
export { Slider } from "./components/forms/Slider.jsx";
export { DatePicker } from "./components/forms/DatePicker.jsx";
export { Table } from "./components/data/Table.jsx";
export { Dialog } from "./components/feedback/Dialog.jsx";
export { Toast } from "./components/feedback/Toast.jsx";
export { Tooltip } from "./components/feedback/Tooltip.jsx";
export { EmptyState } from "./components/feedback/EmptyState.jsx";
export { Tabs } from "./components/navigation/Tabs.jsx";
export { SideNav } from "./components/navigation/SideNav.jsx";
export { TabBar } from "./components/navigation/TabBar.jsx";
export { Viewport, useMeasuredBreakpoint, breakpointFor, BREAKPOINTS } from "./ui_kits/shared/Frames.jsx";
