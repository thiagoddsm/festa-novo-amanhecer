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
  RowSelectionState,
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
import { ChevronDown, ChevronRight, FileDown, Trash2 } from "lucide-react"
import { Checkbox } from "./checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./alert-dialog";

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
  onGeneratePdf?: (data: Row<TData>[]) => void;
  onDeleteSelected?: (selectedData: TData[]) => Promise<void>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumns = [],
  renderSubComponent,
  onGeneratePdf,
  onDeleteSelected,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const tableColumns = React.useMemo(() => {
    const actionColumns: ColumnDef<TData, TValue>[] = [];
    if(onDeleteSelected) {
        actionColumns.push({
            id: 'select',
            header: ({ table }) => (
              <Checkbox
                checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
              />
            ),
            enableSorting: false,
            enableHiding: false,
        });
    }

    if (renderSubComponent) {
        actionColumns.push({
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
        });
    }
    return [...actionColumns, ...columns];
  }, [columns, renderSubComponent, onDeleteSelected]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId: (row: any) => row.id ?? row.uid,
    autoResetPageIndex: false,
    autoResetExpanded: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onRowSelectionChange: setRowSelection,
    getRowCanExpand: () => !!renderSubComponent,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
  })

  const numSelected = table.getFilteredSelectedRowModel().rows.length;

  const handleDelete = () => {
    if (onDeleteSelected) {
        const selectedData = table.getFilteredSelectedRowModel().rows.map(row => row.original);
        onDeleteSelected(selectedData).then(() => {
            table.resetRowSelection();
        });
    }
  }

  return (
    <div>
        <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 flex-wrap">
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
            <div className="flex items-center gap-2">
                {numSelected > 0 && onDeleteSelected && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir ({numSelected})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Isso excluirá permanentemente os {numSelected} item(ns) selecionados.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Continuar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                 {onGeneratePdf && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onGeneratePdf(table.getFilteredRowModel().rows)}
                    >
                        <FileDown className="mr-2 h-4 w-4" />
                        Gerar Relatório PDF
                    </Button>
                )}
            </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} style={{ width: header.id === 'expander' ? '1%' : header.id === 'select' ? '1%' : 'auto' }}>
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
