export function SkeletonRow() {
  return (
    <tr className="skeleton-row" aria-hidden="true">
      <td className="col-name">
        <div className="skeleton-cell">
          <div className="skeleton-bar skeleton-bar--name" />
          <div className="skeleton-bar skeleton-bar--meta" />
        </div>
      </td>
      <td className="col-unit">
        <div className="skeleton-bar skeleton-bar--unit" />
      </td>
      <td className="col-qty">
        <div className="skeleton-bar skeleton-bar--qty" />
      </td>
      <td className="col-unit-weight" />
      <td className="col-calories">
        <div className="skeleton-bar skeleton-bar--cal" />
      </td>
      <td className="col-actions" />
    </tr>
  );
}
