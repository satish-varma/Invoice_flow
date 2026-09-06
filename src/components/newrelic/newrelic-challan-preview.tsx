/**
 * NewRelicChallanPreview
 *
 * Renders the delivery challan matching DOC-569.pdf:
 *   - HungerBox logo (top-right)
 *   - GST / Date / DC No block (top-left)
 *   - "To," recipient block
 *   - "Ref:" subject line
 *   - "To whom so ever it may concern" salutation
 *   - Body paragraph
 *   - 5-column item table with closed grid lines (S.NO | Brand Name | Item Name | QUANTITY | Expiry)
 *   - Stamp & sign image (LAST PAGE ONLY)
 *   - Footer image (EVERY PAGE)
 *
 * Smart pagination:
 *   - Page 1: fits header info + up to 10 items
 *   - Pages 2+: fits continuation header + up to 18 items
 */

import React from 'react';
import { format } from 'date-fns';
import { NewRelicChallan, NewRelicChallanItem, NEWRELIC_LOCATIONS } from '@/services/newrelicChallanService';

const HUNGERBOX_GST = '29AADCE9896J1ZQ';
const FIRST_PAGE_ITEMS = 10;
const SUBSEQUENT_PAGE_ITEMS = 18;

interface Props {
  challan: NewRelicChallan;
}

export const NewRelicChallanPreview = React.forwardRef<HTMLDivElement, Props>(
  ({ challan }, ref) => {
    const locationConfig = NEWRELIC_LOCATIONS[challan.location];
    const addressLines = locationConfig.address.split('\n');

    const formattedDate = challan.dcDate
      ? format(new Date(challan.dcDate), 'dd-MM-yyyy')
      : '';

    // Smart pagination: Page 1 max 10 items, subsequent pages max 18 items
    const pages: { items: NewRelicChallanItem[]; startIndex: number }[] = [];
    const allItems = challan.lineItems ?? [];

    if (allItems.length === 0) {
      pages.push({ items: [], startIndex: 0 });
    } else {
      const page1Items = allItems.slice(0, FIRST_PAGE_ITEMS);
      pages.push({ items: page1Items, startIndex: 0 });

      let offset = FIRST_PAGE_ITEMS;
      while (offset < allItems.length) {
        const pageItems = allItems.slice(offset, offset + SUBSEQUENT_PAGE_ITEMS);
        pages.push({ items: pageItems, startIndex: offset });
        offset += SUBSEQUENT_PAGE_ITEMS;
      }
    }

    return (
      <div ref={ref} style={{ fontFamily: 'Georgia, "Times New Roman", serif', background: '#fff' }}>
        {pages.map((page, pageIndex) => (
          <div
            key={pageIndex}
            style={{
              width: '794px',
              height: '1123px', // Fixed A4 height
              background: '#fff',
              pageBreakAfter: pageIndex < pages.length - 1 ? 'always' : 'auto',
              position: 'relative',
              padding: '50px 64px 100px 64px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* ── Page 1 only: full header + letter body ── */}
            {pageIndex === 0 && (
              <>
                {/* Top row: GST/date/DC on left, Logo on right */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                  {/* Left: meta */}
                  <div style={{ fontSize: '14px', fontStyle: 'italic', lineHeight: '2' }}>
                    <div>Hunger Box GST: {HUNGERBOX_GST}</div>
                    <div style={{ marginTop: '6px' }}>
                      <span>Date: {formattedDate}</span>
                    </div>
                    <div>
                      DC No: <strong>{challan.dcNumber}</strong>
                    </div>
                  </div>

                  {/* Right: HungerBox logo */}
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/hungerbox_logo.png"
                      alt="HungerBox"
                      crossOrigin="anonymous"
                      style={{ width: '140px', objectFit: 'contain' }}
                    />
                  </div>
                </div>

                {/* To block */}
                <div style={{ fontSize: '14px', fontStyle: 'italic', lineHeight: '1.8', marginBottom: '20px' }}>
                  <div>To,</div>
                  {addressLines.map((line, i) => (
                    <div key={i} style={{ fontWeight: i === 0 ? 'bold' : 'normal' }}>
                      {line}
                    </div>
                  ))}
                </div>

                {/* Ref line */}
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontStyle: 'italic', fontSize: '14px', marginBottom: '16px' }}>
                  Ref: DC for Returnable items to be present at New Relic Pvt Ltd.
                </div>

                {/* Salutation */}
                <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '14px', textDecoration: 'underline', marginBottom: '20px' }}>
                  To whom so ever it may concern
                </div>

                {/* Body */}
                <div style={{ fontStyle: 'italic', fontSize: '14px', lineHeight: '1.6', marginBottom: '14px' }}>
                  This is to bring to your notice that the below mentioned Returnable items are stationed at{' '}
                  New Relic Pvt. Ltd.
                </div>

                <div style={{ fontStyle: 'italic', fontSize: '14px', marginBottom: '16px' }}>
                  Items are mentioned below.
                </div>
              </>
            )}

            {/* ── Continuation header on pages 2+ (HungerBox logo header) ── */}
            {pageIndex > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/hungerbox_logo.png"
                  alt="HungerBox"
                  crossOrigin="anonymous"
                  style={{ width: '140px', objectFit: 'contain' }}
                />
              </div>
            )}

            {/* ── Item table (Closed Grid Box) ── */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1.5px solid #000',
                fontSize: '13px',
                fontStyle: 'italic',
                boxSizing: 'border-box',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  {[
                    { title: 'S.NO', align: 'center', width: '8%' },
                    { title: 'Brand Name', align: 'center', width: '22%' },
                    { title: 'Item Name', align: 'left', width: '42%' },
                    { title: 'QUANTITY', align: 'center', width: '13%' },
                    { title: 'Expiry', align: 'center', width: '15%' },
                  ].map((col) => (
                    <th
                      key={col.title}
                      style={{
                        border: '1.5px solid #000',
                        padding: '6px 8px',
                        textAlign: col.align as any,
                        fontWeight: 'bold',
                        fontStyle: 'italic',
                        fontSize: '13px',
                        width: col.width,
                      }}
                    >
                      {col.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.items.map((item, i) => {
                  const globalIndex = page.startIndex + i;
                  return (
                    <tr key={item.id}>
                      <td
                        style={{
                          border: '1.5px solid #000',
                          padding: '5px 8px',
                          textAlign: 'center',
                        }}
                      >
                        {String(globalIndex + 1).padStart(2, '0')}
                      </td>
                      <td
                        style={{
                          border: '1.5px solid #000',
                          padding: '5px 8px',
                          textAlign: 'center',
                        }}
                      >
                        {item.brandName}
                      </td>
                      <td
                        style={{
                          border: '1.5px solid #000',
                          padding: '5px 8px',
                          textAlign: 'left',
                        }}
                      >
                        {item.itemName}
                      </td>
                      <td
                        style={{
                          border: '1.5px solid #000',
                          padding: '5px 8px',
                          textAlign: 'center',
                        }}
                      >
                        {item.quantity}
                      </td>
                      <td
                        style={{
                          border: '1.5px solid #000',
                          padding: '6px 8px',
                          textAlign: 'center',
                        }}
                      >
                        {item.expiry || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── Stamp (LAST PAGE ONLY) ── */}
            {pageIndex === pages.length - 1 && (
              <div style={{ marginTop: '24px', marginBottom: '12px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/hungerbox_stamp_and_sign.png"
                  alt="Stamp and Signature"
                  crossOrigin="anonymous"
                  style={{ width: '120px', objectFit: 'contain' }}
                />
              </div>
            )}

            {/* Flexible spacer pushing footer to bottom */}
            <div style={{ flex: 1 }} />

            {/* ── Footer (EVERY SINGLE PAGE) ── */}
            <div style={{ position: 'absolute', bottom: '20px', left: '64px', right: '64px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hungerbox_footer.png"
                alt="HungerBox Footer"
                crossOrigin="anonymous"
                style={{ width: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
);

NewRelicChallanPreview.displayName = 'NewRelicChallanPreview';
