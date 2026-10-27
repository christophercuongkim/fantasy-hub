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
export { AvatarStack } from "./components/core/AvatarStack.jsx";
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
export { FileDrop } from "./components/forms/FileDrop.jsx";
export { Table } from "./components/data/Table.jsx";
export { Range } from "./components/data/Range.jsx";
export { ListRow } from "./components/data/ListRow.jsx";
export { ListGroup } from "./components/data/ListGroup.jsx";
export { Stepper } from "./components/data/Stepper.jsx";
export { Meter } from "./components/data/Meter.jsx";
export { Dialog } from "./components/feedback/Dialog.jsx";
export { Toast } from "./components/feedback/Toast.jsx";
export { Tooltip } from "./components/feedback/Tooltip.jsx";
export { Popover } from "./components/feedback/Popover.jsx";
export { Combobox } from "./components/feedback/Combobox.jsx";
export { EmptyState } from "./components/feedback/EmptyState.jsx";
export { ErrorState } from "./components/feedback/ErrorState.jsx";
export { Skeleton } from "./components/feedback/Skeleton.jsx";
export { LoadingState } from "./components/feedback/LoadingState.jsx";
export { Progress } from "./components/feedback/Progress.jsx";
export { Disclosure } from "./components/feedback/Disclosure.jsx";
export { Sheet } from "./components/feedback/Sheet.jsx";
export { Tabs } from "./components/navigation/Tabs.jsx";
export { SideNav } from "./components/navigation/SideNav.jsx";
export { TabBar } from "./components/navigation/TabBar.jsx";
export { PageHeader } from "./components/layout/PageHeader.jsx";
export { SplitPane, SplitPaneHeader } from "./components/layout/SplitPane.jsx";
export { GateLayout } from "./components/layout/GateLayout.jsx";
export { TopBar } from "./components/layout/TopBar.jsx";
export { PageBody, pagePad } from "./components/layout/PageBody.jsx";
export { ContentRail } from "./components/layout/ContentRail.jsx";
export { Board, BoardColumn } from "./components/layout/Board.jsx";
export { Viewport, useMeasuredBreakpoint, breakpointFor, BREAKPOINTS } from "./ui_kits/shared/Frames.jsx";
export { useWindowBreakpoint } from "./components/core/useMeasuredBreakpoint.js";

// Filter matchers for the searchable picker (0028) — shared so every long list
// ranks identically. Utilities, not components (hence not a .jsx path).
export { skMatchScore, skFuzzyScore } from "./components/core/match.js";
