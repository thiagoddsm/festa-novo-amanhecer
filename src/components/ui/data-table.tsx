"use client"

import React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  SortingState,
  ColumnFiltersState,
  useReactTable,
  Row,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { ChevronDown, ChevronRight } from "lucide-react"

interface FilterConfig {
    columnId: string;
    placeholder: string;
    options?: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }[];
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterColumns?: FilterConfig[];
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactElement;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumns = [],
  renderSubComponent
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  const tableColumns = React.useMemo(() => {
    if (!renderSubComponent) return columns;
    return [
        {
            id: 'expander',
            header: () => null,
            cell: ({ row }) => {
            return row.getCanExpand() ? (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={row.getToggleExpandedHandler()}
                    className="h-8 w-8"
                >
                    {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
                </Button>
            ) : null
            },
        },
        ...columns
    ]
  }, [columns, renderSubComponent]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => !!renderSubComponent,
    state: {
      sorting,
      columnFilters,
    },
  })

  return (
    <div>
        <div className="flex items-center py-4 gap-2 flex-wrap">
            {filterColumns.map(filterConfig => {
                const column = table.getColumn(filterConfig.columnId);
                if (!column) return null;

                if (filterConfig.options) {
                    return (
                        <DataTableFacetedFilter
                            key={filterConfig.columnId}
                            column={column}
                            title={filterConfig.placeholder.replace('Filtrar ', '').replace('...', '')}
                            options={filterConfig.options}
                        />
                    )
                }
                
                return (
                    <Input
                        key={filterConfig.columnId}
                        placeholder={filterConfig.placeholder}
                        value={(column.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                        column.setFilterValue(event.target.value)
                        }
                        className="max-w-sm h-8"
                    />
                )
            })}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} style={{ width: header.id === 'expander' ? '1%' : 'auto' }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                    <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    >
                    {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                    ))}
                    </TableRow>
                    {row.getIsExpanded() && renderSubComponent && (
                        <TableRow>
                            <TableCell colSpan={tableColumns.length}>
                                {renderSubComponent({ row })}
                            </TableCell>
                        </TableRow>
                    )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
       <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Próxima
        </Button>
      </div>
    </div>
  )
}
