import React, { useCallback, useMemo, memo } from 'react';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
} from '../lightswind/pagination';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface LightswindPaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    /** Optional: show "Showing X to Y of Z items" text */
    showInfo?: boolean;
    totalItems?: number;
    itemsPerPage?: number;
    itemLabel?: string;
    className?: string;
}

export const LightswindPagination = memo(function LightswindPagination({
    currentPage,
    totalPages,
    onPageChange,
    showInfo = false,
    totalItems = 0,
    itemsPerPage = 10,
    itemLabel = 'items',
    className = '',
}: LightswindPaginationProps) {
    // Desktop: show up to 7 pages; Mobile: show up to 3 pages
    const getPageNumbers = useCallback(
        (current: number, total: number, maxVisible: number): (number | 'ellipsis')[] => {
            const pages: (number | 'ellipsis')[] = [];
            if (total <= maxVisible) {
                for (let i = 1; i <= total; i++) pages.push(i);
                return pages;
            }

            pages.push(1);
            if (maxVisible <= 5) {
                // Compact mode (mobile): show current and maybe one neighbor
                if (current <= 2) {
                    for (let i = 2; i <= Math.min(maxVisible - 1, total - 1); i++) pages.push(i);
                    if (total > maxVisible - 1) pages.push('ellipsis');
                    pages.push(total);
                } else if (current >= total - 1) {
                    pages.push('ellipsis');
                    for (let i = Math.max(total - (maxVisible - 2), 2); i <= total; i++) pages.push(i);
                } else {
                    pages.push('ellipsis');
                    pages.push(current);
                    pages.push('ellipsis');
                    pages.push(total);
                }
            } else {
                // Full mode (desktop)
                if (current <= 3) {
                    for (let i = 2; i <= Math.min(5, total - 1); i++) pages.push(i);
                    if (total > 5) pages.push('ellipsis');
                    pages.push(total);
                } else if (current >= total - 2) {
                    pages.push('ellipsis');
                    for (let i = total - 4; i <= total; i++) {
                        if (i > 1) pages.push(i);
                    }
                } else {
                    pages.push('ellipsis');
                    for (let i = current - 1; i <= current + 1; i++) pages.push(i);
                    pages.push('ellipsis');
                    pages.push(total);
                }
            }

            return pages;
        },
        []
    );

    // Desktop pages (full) and mobile pages (compact)
    const desktopPages = useMemo(
        () => getPageNumbers(currentPage, totalPages, 7),
        [currentPage, totalPages, getPageNumbers]
    );
    const mobilePages = useMemo(
        () => getPageNumbers(currentPage, totalPages, 5),
        [currentPage, totalPages, getPageNumbers]
    );

    if (totalPages <= 1) return null;

    return (
        <div
            className={`flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 ${className}`}
        >
            {showInfo && totalItems > 0 && (
                <div className="text-xs sm:text-sm text-slate-400">
                    Showing{' '}
                    <span className="font-semibold text-white">
                        {(currentPage - 1) * itemsPerPage + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-semibold text-white">
                        {Math.min(currentPage * itemsPerPage, totalItems)}
                    </span>{' '}
                    of{' '}
                    <span className="font-semibold text-white">{totalItems}</span>{' '}
                    {itemLabel}
                </div>
            )}

            <Pagination>
                <PaginationContent className="gap-1">
                    {/* Previous Button — icon only on mobile, icon+text on desktop */}
                    <PaginationItem>
                        <button
                            onClick={() => { if (currentPage > 1) onPageChange(currentPage - 1); }}
                            disabled={currentPage === 1}
                            aria-label="Go to previous page"
                            className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-colors h-9 sm:h-10 w-9 sm:w-auto sm:px-4 sm:py-2 hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Previous</span>
                        </button>
                    </PaginationItem>

                    {/* Desktop page numbers (hidden on mobile) */}
                    {desktopPages.map((page, index) => (
                        <PaginationItem key={`d-${index}`} className="hidden sm:block">
                            {page === 'ellipsis' ? (
                                <PaginationEllipsis />
                            ) : (
                                <PaginationLink
                                    isActive={page === currentPage}
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        onPageChange(page);
                                    }}
                                    href="#"
                                    className="cursor-pointer"
                                >
                                    {page}
                                </PaginationLink>
                            )}
                        </PaginationItem>
                    ))}

                    {/* Mobile page numbers (hidden on desktop) */}
                    {mobilePages.map((page, index) => (
                        <PaginationItem key={`m-${index}`} className="sm:hidden">
                            {page === 'ellipsis' ? (
                                <PaginationEllipsis />
                            ) : (
                                <PaginationLink
                                    isActive={page === currentPage}
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        onPageChange(page);
                                    }}
                                    href="#"
                                    className="cursor-pointer h-8 w-8 text-xs"
                                >
                                    {page}
                                </PaginationLink>
                            )}
                        </PaginationItem>
                    ))}

                    {/* Next Button — icon only on mobile, icon+text on desktop */}
                    <PaginationItem>
                        <button
                            onClick={() => { if (currentPage < totalPages) onPageChange(currentPage + 1); }}
                            disabled={currentPage === totalPages}
                            aria-label="Go to next page"
                            className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-colors h-9 sm:h-10 w-9 sm:w-auto sm:px-4 sm:py-2 hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
});

export default LightswindPagination;
