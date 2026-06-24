---
name: ui-ux-responsive-expert
description: A skill to analyze and improve UI/UX responsive design for React and Tailwind CSS components. Use this skill when you need to ensure components are well-structured, responsive across devices (mobile, tablet, desktop), and follow best practices for React and Tailwind CSS.
---

# UI/UX Responsive Expert Skill

This skill provides guidance and analysis for optimizing React components built with Tailwind CSS for responsive UI/UX across various screen sizes.

## How to Use This Skill

When you have a React component using Tailwind CSS that you want to analyze for responsive design, provide the component's code. The skill will then:

1.  **Analyze Component Structure:** Evaluate the component's layout and class usage against responsive design principles.
2.  **Identify Responsive Issues:** Pinpoint areas where responsiveness might be lacking or inconsistent (e.g., desktop-first approaches, fixed widths, inconsistent spacing).
3.  **Suggest Improvements:** Recommend specific changes to Tailwind CSS classes, component structure, or React patterns to enhance responsiveness and UI/UX.
4.  **Adhere to Best Practices:** Ensure the suggestions align with established best practices for mobile-first design, breakpoint usage, and accessibility.

## Core Principles and Best Practices

This skill operates based on the following core principles, detailed further in the `references/best_practices.md` file:

-   **Mobile-First Approach:** Always design for small screens first and then progressively enhance for larger screens.
-   **Tailwind's Breakpoint System:** Utilize `sm`, `md`, `lg`, `xl`, `2xl` prefixes effectively.
-   **Common Responsive Patterns:** Apply patterns like stack-to-row, responsive grids, and conditional visibility.
-   **Typography and Spacing Scaling:** Ensure text and spacing adapt appropriately to different screen sizes.
-   **Container Queries:** Leverage `@container` for component-level responsiveness when appropriate.
-   **React Component Organization:** Maintain clean and manageable class strings, using utilities like `clsx` or `tailwind-merge` for dynamic classes.
-   **Avoid Common Pitfalls:** Guard against issues like missing mobile styles, overuse of fixed widths, and unresponsive images.

## Example Usage

To use this skill, simply provide the React component code you wish to analyze. For instance:

```jsx
// Example Component to Analyze
function MyCard() {
  return (
    <div className="w-full bg-white shadow-lg rounded-lg p-4 md:p-6">
      <h2 className="text-xl font-bold mb-2">Card Title</h2>
      <p className="text-gray-700">
        This is some content for the card. It should be responsive.
      </p>
      <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
        Learn More
      </button>
    </div>
  );
}

export default MyCard;
```

Upon receiving such a component, the skill will provide feedback and suggestions for improvement based on the best practices outlined.

## References

-   [`best_practices.md`](./references/best_practices.md): Detailed guidelines and examples for React + Tailwind CSS responsive design.

