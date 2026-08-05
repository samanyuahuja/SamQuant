"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Search } from "lucide-react";
import { useState } from "react";

import styles from "./workspace.module.css";

export function DataTable<T>({
  data,
  columns,
  caption,
  fileName,
  emptyText = "No rows for this run.",
}: {
  data: T[];
  columns: ColumnDef<T>[];
  caption: string;
  fileName: string;
  emptyText?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  // TanStack Table owns its own callable model; React Compiler intentionally skips it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={styles.dataTable}>
      <div className={styles.tableTools}>
        <label>
          <Search aria-hidden="true" size={14} />
          <span className={styles.visuallyHidden}>Filter {caption}</span>
          <input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Filter rows" />
        </label>
        <button type="button" onClick={() => downloadTable(fileName, table.getFilteredRowModel().rows.map((row) => row.original))}>
          <Download aria-hidden="true" size={14} /> CSV
        </button>
      </div>
      <div className={styles.tableScroller}>
        <table>
          <caption>{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        disabled={!header.column.getCanSort()}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? <ArrowUp size={12} /> : header.column.getIsSorted() === "desc" ? <ArrowDown size={12} /> : <ChevronsUpDown size={12} />}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            )) : (
              <tr><td colSpan={columns.length} className={styles.emptyTable}>{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function downloadTable<T>(fileName: string, data: T[]) {
  if (!data.length) return;
  const keys = Object.keys(data[0] as object) as (keyof T)[];
  const rows = [
    keys.map(String),
    ...data.map((row) => keys.map((key) => csvCell(row[key]))),
  ];
  const url = URL.createObjectURL(new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  const text = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
