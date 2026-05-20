package com.metrolink.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

// ============================================================
// Bus
// ============================================================
class Bus {
    private int           id;
    private String        busNumber;
    private String        plateNo;
    private String        model;
    private boolean       isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Bus() {}

    public int getId()                        { return id; }
    public void setId(int id)                 { this.id = id; }
    public String getBusNumber()              { return busNumber; }
    public void setBusNumber(String v)        { this.busNumber = v; }
    public String getPlateNo()               { return plateNo; }
    public void setPlateNo(String v)         { this.plateNo = v; }
    public String getModel()                  { return model; }
    public void setModel(String v)            { this.model = v; }
    public boolean isActive()                 { return isActive; }
    public void setActive(boolean v)          { this.isActive = v; }
    public LocalDateTime getCreatedAt()       { return createdAt; }
    public void setCreatedAt(LocalDateTime v) { this.createdAt = v; }
    public LocalDateTime getUpdatedAt()       { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v) { this.updatedAt = v; }
}

// ============================================================
// Trip
// ============================================================
class Trip {
    private int           id;
    private LocalDate     tripDate;
    private int           busId;
    private int           driverId;
    private int           conductorId;
    private LocalTime     dispatchTime;
    private LocalTime     arrivalTime;
    private int           tripCount;
    private String        remarks;
    private boolean       isModified;
    private Integer       modifiedBy;
    private LocalDateTime modifiedAt;
    private int           createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    // Joined fields for display
    private String        busNumber;
    private String        driverName;
    private String        conductorName;

    public Trip() {}

    public int getId()                         { return id; }
    public void setId(int id)                  { this.id = id; }
    public LocalDate getTripDate()             { return tripDate; }
    public void setTripDate(LocalDate v)       { this.tripDate = v; }
    public int getBusId()                      { return busId; }
    public void setBusId(int v)                { this.busId = v; }
    public int getDriverId()                   { return driverId; }
    public void setDriverId(int v)             { this.driverId = v; }
    public int getConductorId()                { return conductorId; }
    public void setConductorId(int v)          { this.conductorId = v; }
    public LocalTime getDispatchTime()         { return dispatchTime; }
    public void setDispatchTime(LocalTime v)   { this.dispatchTime = v; }
    public LocalTime getArrivalTime()          { return arrivalTime; }
    public void setArrivalTime(LocalTime v)    { this.arrivalTime = v; }
    public int getTripCount()                  { return tripCount; }
    public void setTripCount(int v)            { this.tripCount = v; }
    public String getRemarks()                 { return remarks; }
    public void setRemarks(String v)           { this.remarks = v; }
    public boolean isModified()                { return isModified; }
    public void setModified(boolean v)         { this.isModified = v; }
    public Integer getModifiedBy()             { return modifiedBy; }
    public void setModifiedBy(Integer v)       { this.modifiedBy = v; }
    public LocalDateTime getModifiedAt()       { return modifiedAt; }
    public void setModifiedAt(LocalDateTime v) { this.modifiedAt = v; }
    public int getCreatedBy()                  { return createdBy; }
    public void setCreatedBy(int v)            { this.createdBy = v; }
    public LocalDateTime getCreatedAt()        { return createdAt; }
    public void setCreatedAt(LocalDateTime v)  { this.createdAt = v; }
    public LocalDateTime getUpdatedAt()        { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v)  { this.updatedAt = v; }
    public String getBusNumber()               { return busNumber; }
    public void setBusNumber(String v)         { this.busNumber = v; }
    public String getDriverName()              { return driverName; }
    public void setDriverName(String v)        { this.driverName = v; }
    public String getConductorName()           { return conductorName; }
    public void setConductorName(String v)     { this.conductorName = v; }
}

// ============================================================
// Income
// ============================================================
class Income {
    private int        id;
    private int        tripId;
    private BigDecimal grossIncome;
    private BigDecimal driverIncome;
    private BigDecimal conductorIncome;
    private BigDecimal driverBond;
    private BigDecimal conductorBond;
    private BigDecimal commission;
    private BigDecimal netIncome;      // computed by DB
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Income() {}

    public int getId()                              { return id; }
    public void setId(int id)                       { this.id = id; }
    public int getTripId()                          { return tripId; }
    public void setTripId(int v)                    { this.tripId = v; }
    public BigDecimal getGrossIncome()              { return grossIncome; }
    public void setGrossIncome(BigDecimal v)        { this.grossIncome = v; }
    public BigDecimal getDriverIncome()             { return driverIncome; }
    public void setDriverIncome(BigDecimal v)       { this.driverIncome = v; }
    public BigDecimal getConductorIncome()          { return conductorIncome; }
    public void setConductorIncome(BigDecimal v)    { this.conductorIncome = v; }
    public BigDecimal getDriverBond()               { return driverBond; }
    public void setDriverBond(BigDecimal v)         { this.driverBond = v; }
    public BigDecimal getConductorBond()            { return conductorBond; }
    public void setConductorBond(BigDecimal v)      { this.conductorBond = v; }
    public BigDecimal getCommission()               { return commission; }
    public void setCommission(BigDecimal v)         { this.commission = v; }
    public BigDecimal getNetIncome()                { return netIncome; }
    public void setNetIncome(BigDecimal v)          { this.netIncome = v; }
    public LocalDateTime getCreatedAt()             { return createdAt; }
    public void setCreatedAt(LocalDateTime v)       { this.createdAt = v; }
    public LocalDateTime getUpdatedAt()             { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v)       { this.updatedAt = v; }
}

// ============================================================
// Expenses
// ============================================================
class Expenses {
    private int        id;
    private int        tripId;
    private BigDecimal diesel;
    private BigDecimal washing;
    private BigDecimal driverSalary;
    private BigDecimal overtime;
    private BigDecimal nightDiff;
    private BigDecimal bonus;
    private BigDecimal cashAdvance;
    private BigDecimal damages;
    private String     damageRemark;
    private Integer    employeeId;     // employee responsible for damage
    private BigDecimal otherExpenses;
    private BigDecimal totalExpenses;  // computed by DB
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Expenses() {}

    public int getId()                           { return id; }
    public void setId(int id)                    { this.id = id; }
    public int getTripId()                       { return tripId; }
    public void setTripId(int v)                 { this.tripId = v; }
    public BigDecimal getDiesel()                { return diesel; }
    public void setDiesel(BigDecimal v)          { this.diesel = v; }
    public BigDecimal getWashing()               { return washing; }
    public void setWashing(BigDecimal v)         { this.washing = v; }
    public BigDecimal getDriverSalary()          { return driverSalary; }
    public void setDriverSalary(BigDecimal v)    { this.driverSalary = v; }
    public BigDecimal getOvertime()              { return overtime; }
    public void setOvertime(BigDecimal v)        { this.overtime = v; }
    public BigDecimal getNightDiff()             { return nightDiff; }
    public void setNightDiff(BigDecimal v)       { this.nightDiff = v; }
    public BigDecimal getBonus()                 { return bonus; }
    public void setBonus(BigDecimal v)           { this.bonus = v; }
    public BigDecimal getCashAdvance()           { return cashAdvance; }
    public void setCashAdvance(BigDecimal v)     { this.cashAdvance = v; }
    public BigDecimal getDamages()               { return damages; }
    public void setDamages(BigDecimal v)         { this.damages = v; }
    public String getDamageRemark()              { return damageRemark; }
    public void setDamageRemark(String v)        { this.damageRemark = v; }
    public Integer getEmployeeId()               { return employeeId; }
    public void setEmployeeId(Integer v)         { this.employeeId = v; }
    public BigDecimal getOtherExpenses()         { return otherExpenses; }
    public void setOtherExpenses(BigDecimal v)   { this.otherExpenses = v; }
    public BigDecimal getTotalExpenses()         { return totalExpenses; }
    public void setTotalExpenses(BigDecimal v)   { this.totalExpenses = v; }
    public LocalDateTime getCreatedAt()          { return createdAt; }
    public void setCreatedAt(LocalDateTime v)    { this.createdAt = v; }
    public LocalDateTime getUpdatedAt()          { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v)    { this.updatedAt = v; }
}

// ============================================================
// TripChangelog
// ============================================================
class TripChangelog {
    private int           id;
    private int           tripId;
    private int           changedBy;
    private String        changeType;    // TRIP_DETAILS | INCOME | EXPENSES
    private String        oldValue;      // JSON string
    private String        newValue;      // JSON string
    private LocalDateTime changedAt;
    private String        changedByName; // joined

    public TripChangelog() {}

    public int getId()                         { return id; }
    public void setId(int id)                  { this.id = id; }
    public int getTripId()                     { return tripId; }
    public void setTripId(int v)               { this.tripId = v; }
    public int getChangedBy()                  { return changedBy; }
    public void setChangedBy(int v)            { this.changedBy = v; }
    public String getChangeType()              { return changeType; }
    public void setChangeType(String v)        { this.changeType = v; }
    public String getOldValue()                { return oldValue; }
    public void setOldValue(String v)          { this.oldValue = v; }
    public String getNewValue()                { return newValue; }
    public void setNewValue(String v)          { this.newValue = v; }
    public LocalDateTime getChangedAt()        { return changedAt; }
    public void setChangedAt(LocalDateTime v)  { this.changedAt = v; }
    public String getChangedByName()           { return changedByName; }
    public void setChangedByName(String v)     { this.changedByName = v; }
}
