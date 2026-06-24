# React + Tailwind CSS Responsive Design Best Practices

This document contains the core principles and best practices for building responsive UI/UX with React and Tailwind CSS. Use these guidelines when analyzing and improving user components.

## 1. Mobile-First Approach (The Golden Rule)

Tailwind CSS uses a mobile-first breakpoint system. This means unprefixed utilities (like `p-4`) apply to all screen sizes, while prefixed utilities (like `md:p-8`) apply at the specified breakpoint and above.

**❌ Bad Practice (Desktop-First):**
```jsx
// Trying to style for desktop first, then overriding for mobile
<div className="w-1/2 sm:w-full flex-row sm:flex-col">
```

**✅ Good Practice (Mobile-First):**
```jsx
// Styling for mobile first, then enhancing for larger screens
<div className="w-full md:w-1/2 flex-col md:flex-row">
```

## 2. Standard Breakpoints

Tailwind's default breakpoints are inspired by common device resolutions:

| Prefix | Minimum Width | CSS Media Query | Target Device |
|--------|---------------|-----------------|---------------|
| (none) | 0px | N/A | Mobile (Default) |
| `sm` | 640px | `@media (min-width: 640px)` | Large Mobile / Small Tablet |
| `md` | 768px | `@media (min-width: 768px)` | Tablet |
| `lg` | 1024px | `@media (min-width: 1024px)` | Laptop / Desktop |
| `xl` | 1280px | `@media (min-width: 1280px)` | Large Desktop |
| `2xl` | 1536px | `@media (min-width: 1536px)` | Extra Large Screens |

## 3. Common Layout Patterns

### The Stack-to-Row Pattern
Very common for cards, features, and split-screen layouts.
```jsx
<div className="flex flex-col md:flex-row gap-4">
  <div className="w-full md:w-1/2">Image/Media</div>
  <div className="w-full md:w-1/2">Content</div>
</div>
```

### The Responsive Grid
Perfect for product listings, image galleries, or feature cards.
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {/* Grid Items */}
</div>
```

### The Hidden/Visible Pattern
Showing or hiding elements based on screen size (e.g., mobile menu vs desktop nav).
```jsx
// Mobile menu button (visible on mobile, hidden on desktop)
<button className="block md:hidden">Menu</button>

// Desktop navigation (hidden on mobile, visible on desktop)
<nav className="hidden md:flex gap-4">...</nav>
```

## 4. Typography and Spacing Scaling

Text and spacing should scale up as the screen gets larger to maintain readability and proportion.

**Typography:**
```jsx
<h1 className="text-2xl md:text-4xl lg:text-5xl font-bold">
  Responsive Heading
</h1>
```

**Spacing (Padding/Margin):**
```jsx
<section className="p-4 md:p-8 lg:p-12">
  {/* Content */}
</section>
```

## 5. Container Queries (Modern Approach)

When a component's layout should depend on its container's size rather than the viewport, use Tailwind's `@container` feature.

```jsx
<div className="@container">
  <div className="flex flex-col @md:flex-row">
    {/* Layout changes when the container reaches the @md size, not the viewport */}
  </div>
</div>
```

## 6. React Component Organization

When building React components with Tailwind, keep the class strings manageable:

1. **Extract complex components:** If a `div` has 15+ classes, consider extracting it into a separate React component.
2. **Use clsx or tailwind-merge:** For dynamic classes, use utilities like `clsx` and `tailwind-merge` (often combined as a `cn` utility) to prevent class conflicts.

```jsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
<div className={cn("p-4 md:p-8", isError && "bg-red-500", className)}>
```

## 7. Common Mistakes to Look For

When analyzing user code, actively look for these anti-patterns:
- **Missing mobile styles:** Assuming the default is desktop.
- **Overuse of fixed widths:** Using `w-[500px]` instead of `w-full max-w-lg`.
- **Inconsistent spacing:** Mixing `gap`, `margin`, and `padding` unpredictably.
- **Unresponsive images:** Missing `w-full`, `h-auto`, or `object-cover` on images.
- **Touch targets too small:** Buttons on mobile should be at least `44px` (e.g., `min-h-[44px] p-2`).
