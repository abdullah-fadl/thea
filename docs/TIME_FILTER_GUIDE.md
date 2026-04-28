# Time Filter System Guide

## Overview

The hospital operations platform now has a comprehensive time granularity filter system that applies consistently across all dashboards and reports.

## Filter Types

### 1. **Day Filter**
- Select a single date
- Shows data for that specific 24-hour period
- Example: "2025-12-15"

### 2. **Week Filter**
- Select week number (1-53) and year
- Automatically calculates the date range (Monday to Sunday)
- Shows aggregated data for the entire week
- Example: "Week 50, 2025" → "2025-12-09 to 2025-12-15"

### 3. **Month Filter**
- Select month and year
- Shows data for the entire calendar month
- Example: "Dec 2025" → "2025-12-01 to 2025-12-31"

### 4. **Shift Filter**
- Select date and shift type
- **Predefined Shifts:**
  - **AM Shift**: 08:00 - 16:00
  - **PM Shift**: 16:00 - 00:00 (midnight)
  - **Night Shift**: 00:00 - 08:00
  - **Custom**: Define your own start and end times
- Example: "Shift: AM - 2025-12-15"

## Components

### TimeFilter Component (`/components/TimeFilter.tsx`)

Reusable filter component with:
- Granularity selector (Day/Week/Month/Shift buttons)
- Dynamic input fields based on selected granularity
- Automatic date calculations (e.g., week number → date range)
- Filter label display
- Optional "Apply Filter" button

**Props:**
```typescript
interface TimeFilterProps {
  value: TimeFilterValue;
  onChange: (value: TimeFilterValue) => void;
  onApply?: () => void;
}
```

**Helper Functions:**
- `getFilterLabel(filter)` - Returns human-readable filter description
- `getAPIParams(filter)` - Converts filter to API query parameters

## Usage in Pages

### Dashboard Example

```typescript
import TimeFilter, { TimeFilterValue, getAPIParams } from '@/components/TimeFilter';

export default function DashboardPage() {
  const [filter, setFilter] = useState<TimeFilterValue>({
    granularity: 'day',
    date: new Date().toISOString().split('T')[0],
  });

  async function fetchData() {
    const params = getAPIParams(filter);
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`/api/dashboard/stats?${queryString}`);
    // ... handle response
  }

  return (
    <div>
      <TimeFilter 
        value={filter} 
        onChange={setFilter} 
        onApply={fetchData} 
      />
      {/* Display filtered data */}
    </div>
  );
}
```

## Backend API Implementation

### Query Parameter Handling

All APIs that support time filtering should accept these parameters:

```typescript
interface FilterParams {
  granularity: 'day' | 'week' | 'month' | 'shift';
  
  // For day granularity
  date?: string;  // YYYY-MM-DD
  
  // For week granularity
  fromDate?: string;  // Week start date
  toDate?: string;    // Week end date
  weekNumber?: string;
  year?: string;
  
  // For month granularity
  month?: string;  // 1-12
  year?: string;
  
  // For shift granularity
  date?: string;
  shiftType?: 'AM' | 'PM' | 'NIGHT' | 'CUSTOM';
  shiftStartTime?: string;  // HH:MM
  shiftEndTime?: string;    // HH:MM
}
```

### MongoDB Query Builder

Use the `buildDateQuery()` function to convert filter parameters to MongoDB date queries:

```typescript
function buildDateQuery(params: FilterParams) {
  switch (params.granularity) {
    case 'day':
      return { date: { $gte: startDate, $lte: endDate } };
    case 'week':
      return { date: { $gte: weekStart, $lte: weekEnd } };
    case 'month':
      return { date: { $gte: monthStart, $lte: monthEnd } };
    case 'shift':
      return { date: { $gte: shiftStart, $lte: shiftEnd } };
  }
}
```

### Example API Route

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = {
    granularity: searchParams.get('granularity') || 'day',
    date: searchParams.get('date') || undefined,
    // ... other params
  };

  const dateQuery = buildDateQuery(params);
  const collection = await getCollection('opd_census');
  const records = await collection.find(dateQuery).toArray();
  
  return NextResponse.json({ records });
}
```

## Pages with Time Filter Support

### ✅ Implemented
1. **Dashboard** (`/dashboard`)
   - API: `/api/dashboard/stats`
   - KPIs update based on filter
   
2. **OPD Daily Stats** (`/opd/daily-stats`)
   - API: `/api/opd/census`
   - Shows census records for selected period

### 🔄 To Be Updated
- OPD Dashboard
- OPD Department View
- OPD Department Days
- OPD Rooms View
- OPD Doctors View
- OPD Clinic Utilization
- IPD Live Beds
- Equipment Checklist
- All other dashboards and reports

## Filter State Management

### Current Implementation
- Local state in each page (`useState`)
- Filter changes trigger data refetch via `useEffect`

### Future Enhancement Options
1. **Context API**: Share filter state across multiple pages
2. **URL Parameters**: Persist filter in URL for bookmarking
3. **Local Storage**: Remember user's last filter selection

## Best Practices

1. **Always use TimeFilter component** - Don't create custom filter UIs
2. **Use getAPIParams()** - Ensures consistent query parameter format
3. **Handle all granularities** - Backend APIs should support all filter types
4. **Show filter label** - Use getFilterLabel() to display current filter
5. **Loading states** - Show loading indicator during data fetch
6. **Empty states** - Handle no data gracefully with helpful messages

## Shift Configuration

Default shift times can be customized per hospital:

```typescript
const SHIFTS = {
  AM: { start: '08:00', end: '16:00' },
  PM: { start: '16:00', end: '00:00' },
  NIGHT: { start: '00:00', end: '08:00' },
};
```

## Testing

### Manual Testing Checklist
- [ ] Day filter: Select date, verify data for that day
- [ ] Week filter: Change week number, verify date range updates
- [ ] Month filter: Select different months, verify correct date range
- [ ] Shift filter: Test each shift type, verify time filtering
- [ ] Custom shift: Set custom times, verify data filtered correctly
- [ ] Apply button: Ensure refetch works on click
- [ ] Filter persistence: Check if filter survives page refresh (if implemented)

### Backend Testing
```bash
# Day filter
curl "http://localhost:3000/api/dashboard/stats?granularity=day&date=2025-12-15"

# Week filter
curl "http://localhost:3000/api/dashboard/stats?granularity=week&fromDate=2025-12-09&toDate=2025-12-15"

# Month filter
curl "http://localhost:3000/api/dashboard/stats?granularity=month&month=12&year=2025"

# Shift filter
curl "http://localhost:3000/api/dashboard/stats?granularity=shift&date=2025-12-15&shiftType=AM"
```

## Troubleshooting

### Issue: Filter not applying
- Check if `onChange` is called when filter changes
- Verify `useEffect` dependency includes filter
- Check API endpoint console for errors

### Issue: Wrong date range
- Verify week number calculation (ISO week standard)
- Check timezone handling (all dates should use UTC midnight)
- Ensure shift time calculations handle day boundaries

### Issue: No data returned
- Check if data exists in database for selected period
- Verify MongoDB date field format matches query
- Check if date query is correctly constructed

## Future Enhancements

1. **Quick Filters**: "Today", "This Week", "This Month" buttons
2. **Date Range Picker**: Visual calendar for date selection
3. **Compare Periods**: Show comparison with previous period
4. **Saved Filters**: Save frequently used filters
5. **Filter Presets**: Hospital-specific preset filters
6. **Export with Filter**: Include filter info in exported files
7. **Real-time Updates**: Auto-refresh data at interval
